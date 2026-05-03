"""ADK audit graph wiring, legacy parity, and pipeline flags."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from ghost_network_buster.config import Settings
from ghost_network_buster.models import AuditState, AuditSummary, CallResult, Provider
from ghost_network_buster.pipeline.adk_audit import build_audit_root_agent, introspection_execution_context
from ghost_network_buster.pipeline.run_audit import run_audit_pipeline
from ghost_network_buster.services.audit_rag import rag_hits_for_audit_state
from ghost_network_buster.services.audit_store import AuditStore


def _minimal_summary(st: AuditState, vm: str) -> AuditSummary:
    n = len(st.results)
    d = n if n > 0 else 1
    ghosts = sum(1 for r in st.results if r.status == "ghost")
    gr = ghosts / d
    return AuditSummary(
        audit_id=st.audit_id,
        status=st.status,
        carrier=st.carrier,
        zip_code=st.zip_code,
        care_needs=list(st.care_needs),
        plan_type=st.plan_type,
        member_plan_label=st.member_plan_label,
        recording_consent=st.recording_consent,
        terms_acknowledged=st.terms_acknowledged,
        started_at=st.started_at.isoformat().replace("+00:00", "Z") if st.started_at else None,
        completed_at=st.completed_at.isoformat().replace("+00:00", "Z") if st.completed_at else None,
        providers_total=st.providers_total,
        calls_completed=n,
        ghost_count=ghosts,
        real_count=sum(1 for r in st.results if r.status == "real"),
        voicemail_count=sum(1 for r in st.results if r.status == "voicemail"),
        other_count=0,
        ghost_rate=gr,
        voicemail_rate=0.0,
        high_ghost_rate=gr >= 0.7,
        complaint_eligible=ghosts > 0,
        top_providers=[],
        results=list(st.results),
        error=st.error if st.status == "failed" else None,
        share_path=f"/results/{st.audit_id}",
        voice_mode=vm,
        loop_agent_note=st.loop_agent_note,
    )


def test_adk_agent_tree_shape() -> None:
    root = build_audit_root_agent(introspection_execution_context())
    names = [a.name for a in root.sub_agents]
    assert names == [
        "directory_agent",
        "parallel_caller_agent",
        "classifier_agent",
        "rag_retrieve_agent",
        "complaint_rag_agent",
        "synthesizer_agent",
    ]


def test_run_audit_pipeline_mark_completed_false(tmp_path) -> None:
    audit_dir = tmp_path / "audits"
    audit_dir.mkdir()
    settings = Settings(
        voice_provider="mock",
        google_cloud_project=None,
        audit_local_dir=str(audit_dir),
        memory_local_dir=None,
        gcs_audits_bucket=None,
        gcs_memory_bucket=None,
        # MockVoiceProvider defaults to 6–9s per call (deploy-safe pacing).
        # Drop to zero so the test stays a few hundred milliseconds.
        mock_voice_delay_min_s=0.0,
        mock_voice_delay_max_s=0.0,
    )
    store = AuditStore(settings)
    audit_id = "flag-audit"
    providers = [
        Provider(npi="1", name="A", phone="555-0101", specialty="Therapy", mock_outcome="real"),
    ]
    st = AuditState(audit_id=audit_id, providers_total=1, carrier="Aetna")
    store.cache_put(st)
    asyncio.run(store.save(st))
    broadcast = AsyncMock()
    ws_hub = object()  # truthy — pipeline only broadcasts when ws is set

    async def _go() -> None:
        await run_audit_pipeline(
            audit_id,
            "Aetna",
            providers,
            settings,
            store,
            ws_hub,
            "mock",
            _minimal_summary,
            broadcast_summary=broadcast,
            mark_completed=False,
        )

    asyncio.run(_go())
    out = asyncio.run(store.load(audit_id))
    assert out is not None
    assert out.status == "running"
    assert len(out.results) == 1
    assert broadcast.await_count >= 1


def test_rag_hits_allow_while_running() -> None:
    st = AuditState(
        audit_id="r1",
        status="running",
        carrier="Aetna",
        zip_code="10001",
        results=[
            CallResult(
                npi="1",
                phone="p",
                status="ghost",
                ghost_reason="disconnected",
                transcript="agent said hi",
                summary="s",
            ),
        ],
    )
    hits = rag_hits_for_audit_state(st, require_completed=False)
    assert isinstance(hits, list)


def test_compute_summary_failed_includes_error() -> None:
    from ghost_network_buster.main import _compute_summary

    st = AuditState(
        audit_id="fail1",
        status="failed",
        error="pipeline exploded",
        carrier="Aetna",
        zip_code="10001",
    )
    summ = _compute_summary(
        st,
        "mock",
        Settings(
            voice_provider="mock",
            high_ghost_rate_threshold=0.7,
        ),
    )
    assert summ.status == "failed"
    assert summ.error == "pipeline exploded"
    assert summ.high_ghost_rate is False


def test_load_providers_preview_semantics() -> None:
    from ghost_network_buster.main import _load_sample_providers

    settings = Settings(
        voice_provider="mock",
        google_cloud_project=None,
        audit_local_dir=None,
        memory_local_dir=None,
        gcs_audits_bucket=None,
        gcs_memory_bucket=None,
        providers_data_file="data/providers_test.json",
    )
    full = _load_sample_providers(None, settings)
    part = _load_sample_providers(1, settings)
    assert len(full) >= 1
    assert len(part) == 1
