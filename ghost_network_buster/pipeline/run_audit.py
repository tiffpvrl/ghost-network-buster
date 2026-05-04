"""Run directory audit: parallel voice calls, memory writes, optional loop refinement."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any

from ghost_network_buster.models import AuditState, CallResult, Provider
from ghost_network_buster.tools.memory_tool import record_call
from ghost_network_buster.tools.voice_provider import get_voice_provider

if TYPE_CHECKING:
    from ghost_network_buster.config import Settings
    from ghost_network_buster.services.audit_store import AuditStore
    from ghost_network_buster.services.ws_hub import WsHub

logger = logging.getLogger(__name__)


def _ghost_rate(state: AuditState) -> float:
    n = len(state.results)
    if n == 0:
        return 0.0
    ghosts = sum(1 for r in state.results if r.status == "ghost")
    return ghosts / n


async def run_audit_pipeline(
    audit_id: str,
    carrier: str,
    providers: list[Provider],
    settings: Settings,
    store: AuditStore,
    ws: WsHub | None,
    voice_mode: str,
    summary_builder: Callable[[AuditState, str], Any],
    broadcast_summary: Callable[[Any], Awaitable[None]] | None = None,
    *,
    mark_completed: bool = True,
) -> None:
    """Run voice verification. When mark_completed is False (ADK orchestration), leave status as running."""
    state = await store.load(audit_id)
    if not state:
        logger.error("Missing audit %s", audit_id)
        return

    async def push() -> None:
        await store.save(state)
        if ws and broadcast_summary:
            summ = summary_builder(state, voice_mode)
            await broadcast_summary(summ)

    try:
        voice = get_voice_provider(settings)
        sem = asyncio.Semaphore(settings.max_parallel_calls)
        logger.info(
            "Audit %s started — %d providers, carrier=%s, voice=%s, parallelism=%d",
            audit_id, len(providers), carrier, voice_mode, settings.max_parallel_calls,
        )

        async def one(p: Provider) -> CallResult:
            async with sem:
                r = await voice.call_provider(p, carrier_hint=carrier, care_needs=list(state.care_needs))
                logger.info(
                    "Audit %s | NPI %s (%s) → %s%s",
                    audit_id, p.npi, p.name, r.status,
                    f" [{r.ghost_reason}]" if r.ghost_reason else "",
                )
                await record_call(settings, r)
                return r

        tasks = [asyncio.create_task(one(p)) for p in providers]
        for fut in asyncio.as_completed(tasks):
            r = await fut
            state.results.append(r)
            state.calls_completed = len(state.results)
            await push()

        by_npi = {p.npi: p for p in providers}
        if settings.loop_reverify_voicemail:
            replaced = False
            new_results: list[CallResult] = []
            for r in state.results:
                if r.status == "voicemail" and r.npi in by_npi:
                    retry = await voice.call_provider(by_npi[r.npi], carrier_hint=carrier, care_needs=list(state.care_needs))
                    await record_call(settings, retry)
                    new_results.append(retry)
                    replaced = True
                else:
                    new_results.append(r)
            if replaced:
                state.results = new_results
                state.calls_completed = len(state.results)
                state.loop_agent_note = "Loop refinement: voicemail numbers re-dialed once."
                await push()

        gr = _ghost_rate(state)
        extra = ""
        if gr >= settings.loop_ghost_rate_threshold:
            extra = f" High ghost rate ({gr:.0%}) — recommend manual QA of sample."
        if extra:
            state.loop_agent_note = (state.loop_agent_note or "").strip() + extra
            await push()

        if mark_completed:
            state.status = "completed"
            state.completed_at = datetime.now(timezone.utc)
            logger.info(
                "Audit %s completed — %d calls, ghost_rate=%.1f%%, complaint_eligible=%s",
                audit_id, len(state.results), _ghost_rate(state) * 100,
                _ghost_rate(state) >= 0.70,
            )
        else:
            logger.info(
                "Audit %s voice phase finished (awaiting ADK tail) — %d calls, ghost_rate=%.1f%%",
                audit_id, len(state.results), _ghost_rate(state) * 100,
            )
        await push()
    except Exception as e:  # noqa: BLE001
        logger.exception("Audit pipeline failed for audit_id=%s", audit_id)
        state.status = "failed"
        state.error = str(e)
        await store.save(state)
        if ws and broadcast_summary:
            await broadcast_summary(summary_builder(state, voice_mode))
