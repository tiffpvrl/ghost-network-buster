"""Google ADK root orchestration for directory audits (directory → voice → classify → RAG → synthesizer)."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import AsyncGenerator

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.events.event import Event
from google.genai import types
from pydantic import Field
from typing_extensions import override

from ghost_network_buster.adk_blueprint import (
    build_complaint_rag_agent,
    build_synthesizer_agent,
    run_agent_async,
)
from ghost_network_buster.config import Settings
from ghost_network_buster.models import AuditState, AuditSummary, CallResult, Provider
from ghost_network_buster.services.audit_store import AuditStore
from ghost_network_buster.services.ws_hub import WsHub

logger = logging.getLogger(__name__)


@dataclass
class AuditExecutionContext:
    """Mutable per-run inputs for custom BaseAgents (store + voice + callbacks)."""

    audit_id: str
    carrier: str
    providers: list[Provider]
    settings: Settings
    store: AuditStore | None
    ws: WsHub | None
    voice_mode: str
    summary_builder: Callable[[AuditState, str], AuditSummary]
    broadcast_summary: Callable[[AuditSummary], Awaitable[None]] | None


def introspection_execution_context() -> AuditExecutionContext:
    """Context used only for /api/agents/graph (agents no-op instead of touching storage)."""

    from ghost_network_buster.config import get_settings  # noqa: PLC0415

    def _forbidden_summary(_state: AuditState, _vm: str) -> AuditSummary:
        raise RuntimeError("Introspection audit context cannot compute summaries")

    return AuditExecutionContext(
        audit_id="_introspection",
        carrier="",
        providers=[],
        settings=get_settings(),
        store=None,
        ws=None,
        voice_mode="mock",
        summary_builder=_forbidden_summary,
        broadcast_summary=None,
    )


def _ghost_rate_from_state(state: AuditState) -> float:
    n = len(state.results)
    if n == 0:
        return 0.0
    return sum(1 for r in state.results if r.status == "ghost") / n


async def map_adk_event_to_ws(ws: WsHub | None, audit_id: str, event: Event) -> None:
    """Forward ADK events to WebSocket clients (alongside summary broadcasts)."""
    if ws is None:
        return
    snippet = ""
    if event.content and event.content.parts:
        for part in event.content.parts:
            text = getattr(part, "text", None)
            if text:
                snippet += text
    await ws.broadcast(
        audit_id,
        {
            "type": "adk_event",
            "author": event.author,
            "final": event.is_final_response(),
            "snippet": (snippet[:800] + "…") if len(snippet) > 800 else snippet,
        },
    )


# ---------------------------------------------------------------------------
# Custom agents
# ---------------------------------------------------------------------------


class DirectoryLoadAgent(BaseAgent):
    """Deduplicate providers by NPI and sync providers_total on AuditState."""

    execution: AuditExecutionContext = Field(...)
    name: str = "directory_agent"
    description: str = "Load and deduplicate insurer directory rows (JSON ingest)."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Directory stage (introspection only).")],
                ),
            )
            return

        seen: set[str] = set()
        deduped: list[Provider] = []
        for p in ex.providers:
            if p.npi in seen:
                continue
            seen.add(p.npi)
            deduped.append(p)
        ex.providers.clear()
        ex.providers.extend(deduped)

        st = await ex.store.load(ex.audit_id)
        if st:
            st.providers_total = len(deduped)
            await ex.store.save(st)

        ctx.session.state["directory_provider_count"] = len(deduped)
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"Directory loaded: {len(deduped)} unique NPI rows after dedupe.")],
            ),
        )


class VoiceFanoutAgent(BaseAgent):
    """Bounded-parallel voice verification (delegates to run_audit_pipeline voice phase)."""

    execution: AuditExecutionContext = Field(...)
    name: str = "parallel_caller_agent"
    description: str = "Parallel outbound voice verification (mock or Pipecat/Twilio)."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Voice fan-out (introspection only).")],
                ),
            )
            return

        from ghost_network_buster.pipeline.run_audit import run_audit_pipeline  # noqa: PLC0415

        async def broadcast(summ: AuditSummary) -> None:
            if ex.broadcast_summary:
                await ex.broadcast_summary(summ)

        await run_audit_pipeline(
            ex.audit_id,
            ex.carrier,
            ex.providers,
            ex.settings,
            ex.store,
            ex.ws,
            ex.voice_mode,
            ex.summary_builder,
            broadcast_summary=broadcast,
            mark_completed=False,
        )
        st = await ex.store.load(ex.audit_id)
        n = len(st.results) if st else 0
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"Voice verification finished for {n} provider calls.")],
            ),
        )


class GraphClassifyAgent(BaseAgent):
    """Apply ac_classify_transcript per result (skippable after Pipecat inline classify)."""

    execution: AuditExecutionContext = Field(...)
    name: str = "classifier_agent"
    description: str = "Hybrid transcript classification (keyword + shared ADK LlmAgent)."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Classifier stage (introspection only).")],
                ),
            )
            return

        st = await ex.store.load(ex.audit_id)
        if not st:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Classifier stage: missing audit state.")],
                ),
            )
            return

        skip = (
            ex.settings.voice_provider == "pipecat"
            and not ex.settings.adk_reclassify_after_pipecat
        )
        if skip:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[
                        types.Part(
                            text="Classifier skipped — Pipecat path already used ac_classify_transcript."
                        )
                    ],
                ),
            )
            return

        from ghost_network_buster.agents.classifier import ac_classify_transcript  # noqa: PLC0415

        gcp = ex.settings.google_cloud_project
        loc = ex.settings.vertex_location
        new_results: list[CallResult] = []
        for r in st.results:
            status, ghost_reason, summary = await ac_classify_transcript(
                r.transcript,
                carrier_hint=ex.carrier,
                gcp_project=gcp,
                vertex_location=loc,
            )
            new_results.append(
                r.model_copy(
                    update={"status": status, "ghost_reason": ghost_reason, "summary": summary},
                )
            )
        st.results = new_results
        st.calls_completed = len(new_results)
        await ex.store.save(st)
        ctx.session.state["classified_call_count"] = len(new_results)

        if ex.broadcast_summary:
            await ex.broadcast_summary(ex.summary_builder(st, ex.voice_mode))

        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"Classification refreshed for {len(new_results)} transcripts.")],
            ),
        )


class RagRetrieveAgent(BaseAgent):
    """Run BM25/corpus retrieve and stash hits on the ADK session for LlmAgents."""

    execution: AuditExecutionContext = Field(...)
    name: str = "rag_retrieve_agent"
    description: str = "Retrieve regulatory corpus chunks for complaint drafting."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="RAG retrieve (introspection only).")],
                ),
            )
            return

        st = await ex.store.load(ex.audit_id)
        if not st:
            return

        from ghost_network_buster.services.audit_rag import rag_hits_for_audit_state  # noqa: PLC0415

        hits = rag_hits_for_audit_state(st, require_completed=False)
        ctx.session.state["rag_hits"] = hits
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"Retrieved {len(hits)} regulatory chunks for synthesis.")],
            ),
        )


class ComplaintRagStageAgent(BaseAgent):
    """ADK LlmAgent: regulatory bullets (persisted on AuditState + session)."""

    execution: AuditExecutionContext = Field(...)
    llm_agent: LlmAgent = Field(...)
    name: str = "complaint_rag_agent"
    description: str = "Synthesize RAG hits into complaint Regulatory Basis bullets."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Complaint RAG Llm (introspection only).")],
                ),
            )
            return

        st = await ex.store.load(ex.audit_id)
        if not st or not ex.settings.google_cloud_project:
            msg = "Skipping RAG Llm — no audit state or GOOGLE_CLOUD_PROJECT."
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part(text=msg)]))
            return

        hits = ctx.session.state.get("rag_hits") or []
        gr = _ghost_rate_from_state(st)
        payload = json.dumps(
            {
                "carrier": st.carrier,
                "zip_code": st.zip_code,
                "ghost_rate": gr,
                "rag_hits": hits,
            }
        )
        try:
            raw = await run_agent_async(self.llm_agent, payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ADK complaint RAG stage failed: %s", exc)
            raw = ""
        ctx.session.state["adk_regulatory_bullets"] = raw
        st.adk_regulatory_bullets = raw or None
        await ex.store.save(st)

        if ex.broadcast_summary:
            await ex.broadcast_summary(ex.summary_builder(st, ex.voice_mode))

        preview = (raw[:400] + "…") if len(raw) > 400 else raw
        yield Event(
            author=self.name,
            content=types.Content(role="model", parts=[types.Part(text=f"Regulatory synthesis:\n{preview}")]),
        )


class SynthesizerStageAgent(BaseAgent):
    """ADK LlmAgent: complaint letter body (persisted on AuditState + session)."""

    execution: AuditExecutionContext = Field(...)
    llm_agent: LlmAgent = Field(...)
    name: str = "synthesizer_agent"
    description: str = "Draft Statement of Fact body for the NY OAG Health Care Bureau."

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        ex = self.execution
        if ex.store is None:
            yield Event(
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text="Synthesizer Llm (introspection only).")],
                ),
            )
            return

        st = await ex.store.load(ex.audit_id)
        if not st or not ex.settings.google_cloud_project:
            msg = "Skipping synthesizer — no audit state or GOOGLE_CLOUD_PROJECT."
            yield Event(author=self.name, content=types.Content(role="model", parts=[types.Part(text=msg)]))
            return

        bullets = ctx.session.state.get("adk_regulatory_bullets") or ""
        hits = ctx.session.state.get("rag_hits") or []
        if not bullets and hits:
            bullets = "\n\n".join(
                f"[{h.get('source', '')}]\n{str(h.get('excerpt', ''))[:500]}" for h in hits
            )
        gr = _ghost_rate_from_state(st)
        payload = json.dumps(
            {
                "carrier": st.carrier,
                "zip_code": st.zip_code,
                "ghost_rate": gr,
                "rag_context": bullets,
            }
        )
        try:
            raw = await run_agent_async(self.llm_agent, payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ADK synthesizer stage failed: %s", exc)
            raw = ""
        ctx.session.state["adk_letter_body"] = raw
        st.adk_letter_body = raw or None
        await ex.store.save(st)

        if ex.broadcast_summary:
            await ex.broadcast_summary(ex.summary_builder(st, ex.voice_mode))

        preview = (raw[:400] + "…") if len(raw) > 400 else raw
        yield Event(
            author=self.name,
            content=types.Content(role="model", parts=[types.Part(text=f"Letter body draft:\n{preview}")]),
        )


def build_audit_root_agent(ex: AuditExecutionContext) -> BaseAgent:
    return SequentialAgent(
        name="ghost_network_buster_root",
        description="Root orchestrator for directory accuracy audits.",
        sub_agents=[
            DirectoryLoadAgent(execution=ex),
            VoiceFanoutAgent(execution=ex),
            GraphClassifyAgent(execution=ex),
            RagRetrieveAgent(execution=ex),
            ComplaintRagStageAgent(execution=ex, llm_agent=build_complaint_rag_agent()),
            SynthesizerStageAgent(execution=ex, llm_agent=build_synthesizer_agent()),
        ],
    )


async def run_audit_with_adk(
    audit_id: str,
    carrier: str,
    providers: list[Provider],
    settings: Settings,
    store: AuditStore,
    ws: WsHub | None,
    voice_mode: str,
    summary_builder: Callable[[AuditState, str], AuditSummary],
    broadcast_summary: Callable[[AuditSummary], Awaitable[None]] | None,
) -> None:
    """
    Build the root SequentialAgent, run one user message to completion, map events to WS,
    then mark the audit completed and broadcast the final summary.
    """
    from google.adk.runners import Runner  # noqa: PLC0415
    from google.adk.sessions.in_memory_session_service import InMemorySessionService  # noqa: PLC0415

    ex = AuditExecutionContext(
        audit_id=audit_id,
        carrier=carrier,
        providers=list(providers),
        settings=settings,
        store=store,
        ws=ws,
        voice_mode=voice_mode,
        summary_builder=summary_builder,
        broadcast_summary=broadcast_summary,
    )
    root = build_audit_root_agent(ex)
    session_service = InMemorySessionService()
    runner = Runner(agent=root, app_name="ghost_network_buster", session_service=session_service)
    session = await session_service.create_session(app_name="ghost_network_buster", user_id="system")
    user_msg = json.dumps({"audit_id": audit_id, "carrier": carrier, "action": "run_full_audit"})
    try:
        async for event in runner.run_async(
            user_id="system",
            session_id=session.id,
            new_message=types.Content(
                role="user",
                parts=[types.Part(text=user_msg)],
            ),
        ):
            await map_adk_event_to_ws(ws, audit_id, event)

        st = await store.load(audit_id)
        if st and st.status != "failed":
            st.status = "completed"
            await store.save(st)
            if broadcast_summary:
                await broadcast_summary(summary_builder(st, voice_mode))
    except Exception as exc:  # noqa: BLE001
        logger.exception("ADK audit failed for audit_id=%s", audit_id)
        st = await store.load(audit_id)
        if st:
            st.status = "failed"
            st.error = str(exc)
            await store.save(st)
            if broadcast_summary:
                await broadcast_summary(summary_builder(st, voice_mode))
