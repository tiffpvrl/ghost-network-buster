"""
FastAPI entry: audits, summaries, PDFs, WebSockets, ADK blueprint, employer mock.

Cloud Run: set PORT (default 8080). Use GCS buckets for audit + NPI memory when provided.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ghost_network_buster.adk_blueprint import agent_tree_to_dict, build_audit_agent_blueprint
from ghost_network_buster.config import Settings, get_settings
from ghost_network_buster.models import AuditState, AuditSummary, Provider
from ghost_network_buster.pipeline.run_audit import run_audit_pipeline
from ghost_network_buster.reports import build_audit_summary_pdf, build_complaint_draft_pdf
from ghost_network_buster.services.audit_store import AuditStore
from ghost_network_buster.services.ws_hub import WsHub
from ghost_network_buster.tools.rag import retrieve
from ghost_network_buster.tools.voice_provider import (
    VoiceConfigurationError,
    get_voice_provider,
    twilio_placeholder_note,
)


def _cors_origins(settings: Settings) -> list[str]:
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.store = AuditStore(settings)
    app.state.ws = WsHub()
    yield


app = FastAPI(title="Ghost Network Buster", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(get_settings()),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_store(request: Request) -> AuditStore:
    return request.app.state.store


def _get_ws(request: Request) -> WsHub:
    return request.app.state.ws


def _require_demo_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_demo_api_key: str | None = Header(default=None, alias="X-Demo-Api-Key"),
) -> None:
    expected = settings.demo_api_key
    if not expected:
        return
    if x_demo_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Demo-Api-Key")


class StartAuditRequest(BaseModel):
    carrier: str = Field(default="Aetna")
    zip_code: str = Field(default="10001", min_length=3, max_length=12)
    care_needs: list[str] = Field(default_factory=list)
    email: str | None = Field(default=None, description="Optional; email send not wired in MVP")
    max_providers: int | None = Field(
        default=None,
        ge=1,
        le=500,
        description="Limit rows from sample file for quick tests",
    )


def _load_sample_providers(limit: int | None, settings: Settings | None = None) -> list[Provider]:
    settings = settings or get_settings()
    base = Path(__file__).resolve().parent.parent
    p = Path(settings.providers_data_file)
    path = p if p.is_absolute() else base / p
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "providers" in raw:
        raw = raw["providers"]
    if not isinstance(raw, list):
        return []
    providers = [Provider.model_validate(row) for row in raw]
    if limit is not None:
        return providers[:limit]
    return providers


def _rag_hits_for_state(state: AuditState) -> list[dict[str, object]]:
    if state.status != "completed":
        return []
    n = len(state.results) or 1
    ghosts = sum(1 for r in state.results if r.status == "ghost")
    gr = ghosts / n
    q = (
        f"mental health network directory accuracy inadequate ghost providers "
        f"insurance {state.carrier} zip {state.zip_code} ghost rate {gr:.0%} "
        f"MHPAEA parity NSA directory verification "
        f"NY Insurance Law 3217-a 4324 network adequacy DFS complaint"
    )
    hits = retrieve(q, top_k=4)
    rows: list[dict[str, object]] = []
    for h in hits:
        row: dict[str, object] = {
            "source": h["source"],
            "excerpt": h["excerpt"],
            "score": round(h["score"], 4),
        }
        if h.get("doc_type"):
            row["doc_type"] = h["doc_type"]
        if h.get("jurisdiction"):
            row["jurisdiction"] = h["jurisdiction"]
        rows.append(row)
    return rows


def _compute_summary(state: AuditState, voice_mode: str) -> AuditSummary:
    results = state.results
    n = len(results)
    denom = n if n > 0 else 1
    ghosts = sum(1 for r in results if r.status == "ghost")
    real = sum(1 for r in results if r.status == "real")
    vm = sum(1 for r in results if r.status == "voicemail")
    other = n - ghosts - real - vm
    gr = ghosts / denom
    vr = vm / denom
    top = [r for r in results if r.status == "real"][:3]
    rag = _rag_hits_for_state(state) if state.status == "completed" else []
    return AuditSummary(
        audit_id=state.audit_id,
        status=state.status,
        carrier=state.carrier,
        zip_code=state.zip_code,
        care_needs=list(state.care_needs),
        providers_total=state.providers_total,
        calls_completed=n,
        ghost_count=ghosts,
        real_count=real,
        voicemail_count=vm,
        other_count=max(0, other),
        ghost_rate=gr,
        voicemail_rate=vr,
        complaint_eligible=gr >= 0.70,
        top_providers=top,
        results=list(results),
        share_path=f"/results/{state.audit_id}",
        voice_mode=voice_mode,
        loop_agent_note=state.loop_agent_note,
        rag_hits=rag,
    )


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/voice/info")
async def voice_info(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    return {
        "voice_provider": settings.voice_provider,
        "retell_configured": bool(settings.retell_api_key and settings.retell_agent_id),
        "twilio_env_present": bool(
            settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number
        ),
        "twilio_next_steps": twilio_placeholder_note(),
        "persistence": {
            "gcs_audits_bucket": settings.gcs_audits_bucket,
            "audit_local_dir": settings.audit_local_dir,
            "gcs_memory_bucket": settings.gcs_memory_bucket,
            "memory_local_dir": settings.memory_local_dir,
        },
    }


@app.get("/api/agents/graph", dependencies=[Depends(_require_demo_key)])
async def agents_graph() -> dict[str, Any]:
    root = build_audit_agent_blueprint()
    return {"blueprint": agent_tree_to_dict(root)}


@app.post("/api/start-audit", dependencies=[Depends(_require_demo_key)])
async def start_audit(
    body: StartAuditRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    store: AuditStore = _get_store(request)
    ws: WsHub = _get_ws(request)
    providers = _load_sample_providers(body.max_providers, settings)
    if not providers:
        raise HTTPException(
            status_code=500,
            detail="No sample providers: add data/providers_sample.json",
        )
    audit_id = str(uuid.uuid4())
    state = AuditState(
        audit_id=audit_id,
        providers_total=len(providers),
        calls_completed=0,
        results=[],
        carrier=body.carrier,
        zip_code=body.zip_code,
        care_needs=body.care_needs,
        email=body.email,
    )
    try:
        get_voice_provider(settings)
    except VoiceConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    store.cache_put(state)
    await store.save(state)

    async def broadcast(summ: AuditSummary) -> None:
        await ws.broadcast_summary(audit_id, summ)

    asyncio.create_task(
        run_audit_pipeline(
            audit_id,
            body.carrier,
            providers,
            settings,
            store,
            ws,
            settings.voice_provider,
            lambda st, vm: _compute_summary(st, vm),
            broadcast_summary=broadcast,
        )
    )
    return {"audit_id": audit_id}


@app.get("/api/status/{audit_id}", dependencies=[Depends(_require_demo_key)])
async def get_status(
    audit_id: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> AuditState:
    store = _get_store(request)
    state = await store.load(audit_id)
    if not state:
        raise HTTPException(status_code=404, detail="Unknown audit_id")
    return state


@app.get("/api/summary/{audit_id}", dependencies=[Depends(_require_demo_key)])
async def get_summary(
    audit_id: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> AuditSummary:
    store = _get_store(request)
    state = await store.load(audit_id)
    if not state:
        raise HTTPException(status_code=404, detail="Unknown audit_id")
    return _compute_summary(state, settings.voice_provider)


@app.websocket("/ws/audit/{audit_id}")
async def audit_ws(websocket: WebSocket, audit_id: str, request: Request) -> None:
    settings: Settings = request.app.state.settings
    if settings.demo_api_key:
        key = websocket.query_params.get("demo_key")
        if key != settings.demo_api_key:
            await websocket.close(code=4401)
            return
    hub: WsHub = _get_ws(request)
    await hub.connect(audit_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(audit_id, websocket)


@app.get("/api/download/summary/{audit_id}", dependencies=[Depends(_require_demo_key)])
async def download_summary(
    audit_id: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Response:
    store = _get_store(request)
    state = await store.load(audit_id)
    if not state or state.status != "completed":
        raise HTTPException(status_code=400, detail="Audit not completed")
    summary = _compute_summary(state, settings.voice_provider)
    pdf = build_audit_summary_pdf(state, summary)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="gnb-audit-{audit_id[:8]}.pdf"'},
    )


@app.get("/api/download/complaint/{audit_id}", dependencies=[Depends(_require_demo_key)])
async def download_complaint(
    audit_id: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Response:
    store = _get_store(request)
    state = await store.load(audit_id)
    if not state or state.status != "completed":
        raise HTTPException(status_code=400, detail="Audit not completed")
    summary = _compute_summary(state, settings.voice_provider)
    if not summary.complaint_eligible:
        raise HTTPException(
            status_code=400,
            detail="Complaint draft available when ghost rate is at least 70%.",
        )
    pdf = build_complaint_draft_pdf(state, summary, rag_hits=summary.rag_hits)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="gnb-complaint-{audit_id[:8]}.pdf"'},
    )


@app.get("/api/employer/mock-dashboard", dependencies=[Depends(_require_demo_key)])
async def employer_mock_dashboard() -> dict[str, object]:
    return {
        "title": "Employer network health (illustrative)",
        "ghost_rate_by_carrier": [
            {"carrier": "Aetna", "ghost_rate": 0.71},
            {"carrier": "BCBS-NY", "ghost_rate": 0.84},
            {"carrier": "Cigna", "ghost_rate": 0.63},
            {"carrier": "UHC", "ghost_rate": 0.69},
        ],
        "exposure_usd_per_untreated_annual": 4783,
        "example_headcount": 500,
        "example_untreated_fraction": 0.10,
        "broken_specialties": [
            {
                "label": "Trauma + Spanish-speaking",
                "real_providers_within_25mi": 0,
                "employees_affected_estimate": 12,
            },
            {
                "label": "ADHD + adolescent",
                "real_providers_within_25mi": 2,
                "employees_affected_estimate": 28,
            },
        ],
        "renewal_lever": (
            "Aggregate, call-backed ghost rates by carrier — designed to support renewal "
            "negotiations and corrective action requests."
        ),
    }
