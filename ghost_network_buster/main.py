"""
FastAPI entry: audits, summaries, PDFs, WebSockets, ADK blueprint, employer mock.

Cloud Run: set PORT (default 8080). Use GCS buckets for audit + NPI memory when provided.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ghost_network_buster.adk_blueprint import agent_tree_to_dict, build_audit_agent_blueprint
from ghost_network_buster.config import Settings, get_settings
from ghost_network_buster.models import AuditState, AuditSummary, Provider
from ghost_network_buster.pipeline.run_audit import run_audit_pipeline
from ghost_network_buster.reports import build_audit_summary_pdf, build_complaint_draft_docx
from ghost_network_buster.services.audit_store import AuditStore
from ghost_network_buster.services.ws_hub import WsHub
from ghost_network_buster.tools.rag import retrieve
from ghost_network_buster.tools.voice_provider import (
    VoiceConfigurationError,
    get_voice_provider,
    twilio_placeholder_note,
)

# ---------------------------------------------------------------------------
# Pipecat imports — loaded at startup so the first call has no cold-start lag.
# All wrapped in try/except; the server still works without the pipecat extra.
# ---------------------------------------------------------------------------
try:
    from pipecat.audio.vad.silero import SileroVADAnalyzer
    from pipecat.audio.vad.vad_analyzer import VADParams
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineParams, PipelineTask
    from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
    from pipecat.frames.frames import (
        BotStartedSpeakingFrame,
        BotStoppedSpeakingFrame,
        EndFrame,
        InterimTranscriptionFrame,
        LLMTextFrame,
        OutputAudioRawFrame,
        TranscriptionFrame,
        LLMFullResponseEndFrame,
        LLMFullResponseStartFrame,
    )
    from pipecat.services.deepgram.stt import DeepgramSTTService
    from pipecat.services.deepgram.tts import DeepgramTTSService
    from pipecat.services.tts_service import TextAggregationMode
    from pipecat.transports.websocket.fastapi import (
        FastAPIWebsocketTransport,
        FastAPIWebsocketParams,
    )
    from pipecat.serializers.twilio import TwilioFrameSerializer
    from pipecat.processors.audio.vad_processor import VADProcessor

    _PIPECAT_AVAILABLE = True
except ImportError:
    _PIPECAT_AVAILABLE = False


def _cors_origins(settings: Settings) -> list[str]:
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


# region agent log
def _agent_debug_log(location: str, message: str, data: dict[str, Any], hypothesis_id: str = "") -> None:
    """Append one NDJSON line to debug-b6e268.log at repo root (no secrets/PII)."""

    try:
        import time

        log_path = Path(__file__).resolve().parent.parent / "debug-b6e268.log"
        payload = {
            "sessionId": "b6e268",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        log_path.open("a", encoding="utf-8").write(json.dumps(payload) + "\n")
    except Exception:
        pass


# endregion


async def _seed_demo_state(store: AuditStore) -> None:
    """Pre-populate the demo audit so download endpoints work immediately on startup."""
    from ghost_network_buster.models import AuditState, CallResult as CR  # noqa: PLC0415

    results = [
        CR(npi="1234567890", phone="212-555-0101", status="ghost", ghost_reason="disconnected",
           provider_name="Dr. Sarah Chen, LCSW", specialty="Anxiety, Trauma",
           transcript="Agent: Hi, I'm calling to verify if Dr. Sarah Chen accepts Aetna insurance and is accepting new patients for anxiety and trauma therapy.\n[Automated message: The number you have dialed has been disconnected or is no longer in service.]\nAgent: Logging result — disconnected number.",
           summary="Number disconnected. Provider unreachable.", verified_at="2026-05-02T10:01:00Z"),
        CR(npi="1234567891", phone="212-555-0102", status="ghost", ghost_reason="wrong_network",
           provider_name="Dr. Marcus Webb, PhD", specialty="CBT, Depression",
           transcript="Agent: Hi, I'm calling to verify whether Dr. Webb accepts Aetna insurance for outpatient therapy.\nReceptionist: Dr. Webb dropped Aetna back in 2023. He's cash-pay only now.\nAgent: Is he planning to rejoin any networks?\nReceptionist: No, I don't believe so.",
           summary="No longer in Aetna network since 2023.", verified_at="2026-05-02T10:02:30Z"),
        CR(npi="1234567892", phone="212-555-0103", status="ghost", ghost_reason="not_accepting_patients",
           provider_name="East Side Wellness Center", specialty="General Therapy",
           transcript="Agent: Good afternoon. I'm calling to confirm if you're accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: We're completely full. The waitlist has been closed since February — we don't know when we'll reopen it.\nAgent: Can you give any estimate on timeline?\nReceptionist: Honestly, no. I'd suggest looking elsewhere.",
           summary="Closed waitlist since February, no timeline to reopen.", verified_at="2026-05-02T10:04:00Z"),
        CR(npi="1234567893", phone="212-555-0104", status="real", ghost_reason=None,
           provider_name="Dr. Linda Okafor, LMFT", specialty="Trauma-Informed CBT",
           transcript="Agent: Hi, I'm calling to verify if Dr. Okafor is accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: Yes! Dr. Okafor is in-network with Aetna and we do have availability. She specializes in trauma-informed CBT.\nAgent: Can you confirm she's currently accepting new patients?\nReceptionist: Absolutely — openings as early as next week.",
           summary="Confirmed in-network, accepting new patients. Openings next week.", verified_at="2026-05-02T10:05:30Z"),
        CR(npi="1234567894", phone="212-555-0105", status="ghost", ghost_reason="wrong_provider",
           provider_name="Dr. James Ostrowski, PsyD", specialty="Behavioral Health",
           transcript="Agent: Hi, I'm trying to reach Dr. James Ostrowski at Midtown Behavioral Health.\nReceptionist: Dr. Ostrowski hasn't practiced here in over two years. We don't know where he relocated.\nAgent: Is there another Aetna-network therapist at this location?\nReceptionist: We don't have any Aetna providers on staff.",
           summary="Provider left practice 2+ years ago. Location has no Aetna coverage.", verified_at="2026-05-02T10:07:00Z"),
        CR(npi="1234567895", phone="212-555-0106", status="ghost", ghost_reason="no_behavioral_health",
           provider_name="Dr. Patricia Gonzalez, MD", specialty="Listed: Behavioral Health",
           transcript="Agent: I'm calling to confirm if Dr. Gonzalez provides behavioral health services and accepts Aetna for therapy.\nReceptionist: Dr. Gonzalez is an orthopedic surgeon. We don't offer any mental health services here.\nAgent: She's listed in Aetna's behavioral health directory — is that an error?\nReceptionist: That has to be a mistake. This is a surgical practice.",
           summary="Orthopedic surgeon, no behavioral health services. Directory listing is erroneous.", verified_at="2026-05-02T10:08:30Z"),
        CR(npi="1234567896", phone="212-555-0107", status="ghost", ghost_reason="retired",
           provider_name="Dr. Kevin Park, LCSW", specialty="Anxiety, PTSD",
           transcript="Agent: Good morning. I'm verifying whether Dr. Park is currently seeing patients and accepting Aetna for mental health therapy.\nReceptionist: Dr. Park retired in early 2024. This line is forwarded to billing only.\nAgent: Is there another provider at this location?\nReceptionist: The practice is closed. We're only handling final billing.",
           summary="Retired 2024. Practice closed.", verified_at="2026-05-02T10:10:00Z"),
        CR(npi="1234567897", phone="718-555-0108", status="real", ghost_reason=None,
           provider_name="Brooklyn Mind Collective", specialty="Anxiety, Trauma / PTSD",
           transcript="Agent: Hi, calling to confirm whether Brooklyn Mind Collective is accepting new Aetna patients for anxiety and trauma-focused therapy.\nReceptionist: Yes, we are! We have three therapists in-network with Aetna who specialize in anxiety and PTSD.\nAgent: Are they currently taking new patients?\nReceptionist: Two of them are — we can get someone in within two weeks.",
           summary="Confirmed in-network. 2 of 3 therapists accepting. Available within 2 weeks.", verified_at="2026-05-02T10:11:30Z"),
    ]
    state = AuditState(
        audit_id="demo",
        status="completed",
        providers_total=8,
        calls_completed=8,
        results=results,
        carrier="Aetna",
        zip_code="10001",
        care_needs=["Anxiety", "Trauma / PTSD"],
    )
    store.cache_put(state)
    await store.save(state)
    logger.info("Demo audit state seeded (audit_id=demo)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    store = AuditStore(settings)
    app.state.store = store
    app.state.ws = WsHub()
    await _seed_demo_state(store)
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
    override_cost_guard: bool = Field(
        default=False,
        description="Set true to bypass pipecat_cost_guard limit (use carefully — real Twilio charges apply).",
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
        complaint_eligible=ghosts > 0,
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


class ClassifyRequest(BaseModel):
    transcript: str
    carrier: str = "Aetna"


@app.post("/api/agents/classify", dependencies=[Depends(_require_demo_key)])
async def agents_classify(
    body: ClassifyRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Run the ADK classifier agent on a transcript via the ADK Runner."""
    import json as _json
    import re as _re

    from ghost_network_buster.adk_blueprint import run_agent_async

    if not settings.google_cloud_project:
        raise HTTPException(status_code=503, detail="GOOGLE_CLOUD_PROJECT not configured")

    blueprint = build_audit_agent_blueprint()
    classifier = next(a for a in blueprint.sub_agents if a.name == "classifier_agent")

    message = _json.dumps({"transcript": body.transcript, "carrier": body.carrier})
    raw = await run_agent_async(
        classifier,
        message,
        project=settings.google_cloud_project,
        location=settings.vertex_location,
    )

    try:
        cleaned = _re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=_re.MULTILINE).strip()
        result: Any = _json.loads(cleaned)
    except Exception:
        result = {"raw": raw}

    return {"adk_result": result, "agent": "classifier_agent"}


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

    # Cost guard: block large pipecat batches to prevent accidental Twilio charges.
    if settings.voice_provider == "pipecat":
        est = len(providers) * 0.75 * 0.014
        if settings.pipecat_cost_guard > 0 and len(providers) > settings.pipecat_cost_guard and not body.override_cost_guard:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cost guard: {len(providers)} providers would cost ~${est:.2f} in Twilio charges "
                    f"(PIPECAT_COST_GUARD={settings.pipecat_cost_guard}). "
                    "Pass override_cost_guard=true to proceed, or reduce max_providers."
                ),
            )
        logger.warning(
            "PIPECAT AUDIT STARTING — %d real Twilio calls, est. $%.2f. "
            "Monitor at console.twilio.com.",
            len(providers),
            est,
        )

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
            detail="Complaint draft requires at least one ghost listing.",
        )
    docx = build_complaint_draft_docx(state, summary, rag_hits=summary.rag_hits, gcp_project=settings.google_cloud_project, vertex_location=settings.vertex_location)
    return Response(
        content=docx,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="gnb-complaint-{audit_id[:8]}.docx"'},
    )


@app.post("/webhook/twilio/answer/{call_id}")
async def twilio_answer(call_id: str, settings: Settings = Depends(get_settings)) -> Response:
    """
    Twilio hits this URL when the provider answers the call.
    Returns TwiML that streams audio to the Pipecat WebSocket pipeline.
    """
    from ghost_network_buster.tools.pipecat_provider import _CALL_META  # noqa: PLC0415

    meta = _CALL_META.get(call_id, {})
    carrier_hint = meta.get("carrier_hint", "your insurance")
    public_host = (settings.public_url or "").replace("https://", "").replace("http://", "").rstrip("/")
    ws_url = f"wss://{public_host}/ws/twilio-audio/{call_id}"
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        "<Connect>"
        f'<Stream url="{ws_url}">'
        f'<Parameter name="carrier_hint" value="{carrier_hint}"/>'
        "</Stream>"
        "</Connect>"
        "</Response>"
    )
    return Response(content=twiml, media_type="text/xml")


@app.websocket("/ws/twilio-audio/{call_id}")
async def twilio_audio_ws(websocket: WebSocket, call_id: str) -> None:
    """
    Pipecat pipeline: Twilio audio stream → Deepgram STT → interim commit → Gemini LLM → Deepgram TTS → audio back.
    Resolves the pending Future in pipecat_provider when the call ends.
    """
    from datetime import datetime, timezone  # noqa: PLC0415

    from ghost_network_buster.agents.classifier import classify_transcript  # noqa: PLC0415
    from ghost_network_buster.models import CallResult  # noqa: PLC0415
    from ghost_network_buster.services.stt_interim_commit import SttInterimCommitProcessor  # noqa: PLC0415
    from ghost_network_buster.tools.pipecat_provider import _CALL_META, _PENDING_CALLS  # noqa: PLC0415

    await websocket.accept()
    logger.info("Pipecat WS opened for call_id=%s", call_id)

    meta = _CALL_META.get(call_id, {})
    provider = meta.get("provider")
    carrier_hint = meta.get("carrier_hint", "your insurance")
    future = _PENDING_CALLS.get(call_id)

    def _looks_like_ivr_or_menu_stt(text: str) -> bool:
        """Strong IVR / hold-menu phrases only — avoid substring false positives on real speech."""
        s = text.strip().lower()
        if len(s) < 2:
            return True
        # Phrase-level cues only (removed bare "seconds", "wireless", "goodbye", "extension", …).
        needles = (
            "press ",
            "press,",
            "pound key",
            "star key",
            "dial ",
            "please hold",
            "thank you for calling",
            "your call is important",
            "your call may be",
            "you've reached",
            "twilio trial",
            "main menu",
            "invalid option",
            "for english",
            "para español",
            "listen closely",
            "listen carefully",
            "estimated wait",
        )
        return any(n in s for n in needles)

    def _short_digit_menu_noise(text: str) -> bool:
        """Spelled digits or digit-only lines from 'press 1' flows (not yes/no answers)."""
        s = text.strip().lower()
        if len(s) > 24:
            return False
        if s in {
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "zero",
            "oh",
        }:
            return True
        return bool(re.fullmatch(r"[\d\s\-\.\(\)]+", s)) and len(s) <= 14
    settings: Settings = websocket.app.state.settings
    ts = datetime.now(timezone.utc).isoformat()

    def _resolve(result: CallResult) -> None:
        if future and not future.done():
            future.set_result(result)

    try:
        if not _PIPECAT_AVAILABLE:
            raise ImportError("pipecat not installed")

        # Pre-read the Twilio handshake messages to extract stream_sid and call_sid
        # before the pipeline starts (TwilioFrameSerializer needs stream_sid upfront).
        # This happens FIRST — before any heavy pipeline setup — so the pipeline is
        # ready to speak as soon as Twilio sends the first audio frame.
        stream_sid = ""
        call_sid = ""
        async for raw_msg in websocket.iter_text():
            msg = json.loads(raw_msg)
            if msg.get("event") == "connected":
                continue
            if msg.get("event") == "start":
                stream_sid = msg.get("streamSid", "")
                call_sid = msg.get("start", {}).get("callSid", "")
                break
        logger.info(
            "Twilio stream ready call_id=%s stream_sid=%r call_sid=%r",
            call_id, stream_sid, call_sid,
        )
        _agent_debug_log(
            "twilio_audio_ws:stream_ready",
            "Twilio Media Stream start event received",
            {"call_id": call_id, "has_stream_sid": bool(stream_sid), "tts": "deepgram"},
            hypothesis_id="H5_stream",
        )

        transcript_lines: list[str] = []

        class TranscriptCapture(FrameProcessor):
            """Logs agent + provider lines for audits.

            Deepgram emits InterimTranscriptionFrame while the caller speaks and TranscriptionFrame
            when an utterance is final. If the call ends before a final, we would previously lose
            provider text — we fold interim lines in and replace them with the final when it arrives.

            LLM replies may arrive as many LLMTextFrame chunks (streaming); we record one Agent line
            per LLM turn on LLMFullResponseEndFrame.
            """

            def __init__(self) -> None:
                super().__init__()
                self._agent_llm_accum: str = ""

            async def process_frame(self, frame, direction: FrameDirection):  # type: ignore[override]
                await super().process_frame(frame, direction)
                if isinstance(frame, InterimTranscriptionFrame):
                    partial = frame.text.strip()
                    if partial:
                        marked = f"Provider: {partial} [partial]"
                        if transcript_lines and transcript_lines[-1].endswith(" [partial]"):
                            transcript_lines[-1] = marked
                        else:
                            transcript_lines.append(marked)
                elif isinstance(frame, TranscriptionFrame):
                    final_txt = frame.text.strip()
                    if final_txt:
                        final_line = f"Provider: {final_txt}"
                        if transcript_lines and transcript_lines[-1].endswith(" [partial]"):
                            transcript_lines[-1] = final_line
                        else:
                            transcript_lines.append(final_line)
                elif isinstance(frame, LLMFullResponseStartFrame):
                    self._agent_llm_accum = ""
                elif isinstance(frame, LLMTextFrame):
                    self._agent_llm_accum += frame.text
                elif isinstance(frame, LLMFullResponseEndFrame):
                    if self._agent_llm_accum.strip():
                        transcript_lines.append(f"Agent: {self._agent_llm_accum.strip()}")
                    self._agent_llm_accum = ""
                await self.push_frame(frame, direction)

        provider_name = provider.name if provider else "the practice"
        system_prompt = (
            f"You are a healthcare directory verification assistant on a live phone call with {provider_name}. "
            f"A recorded introduction was already played at the start of this call — do NOT repeat it, "
            f"do NOT say you are calling on behalf of a new patient again unless they ask who is calling. "
            f"Your goal is to verify whether the practice accepts {carrier_hint} for behavioral health "
            "and is accepting new patients. "
            "Reply in at most two short sentences. Stay on topic; do not invent appointments, doctors, or addresses. "
            "When the provider answers your question, acknowledge briefly (e.g. yes/no/clarifying question), "
            "then if you have a clear answer say 'Thank you so much, have a great day!' and stop. "
            "If their reply is unclear or sounds like a phone menu, ask one short clarifying question — "
            f"without repeating the long introduction — about {carrier_hint} and new patients. "
            "If asked, say honestly that you are an AI assistant. Keep the call under 90 seconds."
        )

        class _VertexLLMProcessor(FrameProcessor):
            """Minimal Vertex AI LLM processor using google.genai SDK."""

            def __init__(self) -> None:
                super().__init__()
                from google import genai  # noqa: PLC0415
                self._client = genai.Client(
                    vertexai=True,
                    project=settings.google_cloud_project,
                    location=settings.vertex_location,
                )
                self._history: list = []
                self._bot_speaking: bool = False
                self._llm_in_progress: bool = False

            async def process_frame(self, frame, direction: FrameDirection):  # type: ignore[override]
                await super().process_frame(frame, direction)
                # Bug 1: track when the bot is speaking so we ignore STT echo.
                if isinstance(frame, BotStartedSpeakingFrame):
                    self._bot_speaking = True
                    await self.push_frame(frame, direction)
                    return
                if isinstance(frame, BotStoppedSpeakingFrame):
                    self._bot_speaking = False
                    await self.push_frame(frame, direction)
                    return
                if isinstance(frame, TranscriptionFrame):
                    logger.info(
                        "STT TranscriptionFrame: bot_speaking=%s llm_in_progress=%s empty=%s text=%r",
                        self._bot_speaking,
                        self._llm_in_progress,
                        not frame.text.strip(),
                        frame.text.strip()[:200],
                    )
                if isinstance(frame, TranscriptionFrame) and frame.text.strip():
                    # Bug 1: drop STT frames while the bot's own TTS is playing.
                    if self._bot_speaking:
                        return
                    # Bug 2: set the in-progress flag synchronously before any await so
                    # concurrent frames that arrive while we yield cannot slip through.
                    # (asyncio.Lock.locked() check + async-with had a TOCTOU window.)
                    if self._llm_in_progress:
                        return
                    self._llm_in_progress = True  # no await between check and set — atomic
                    try:
                        raw = frame.text.strip()
                        await self.push_frame(frame, direction)
                        if _looks_like_ivr_or_menu_stt(raw) or _short_digit_menu_noise(raw):
                            logger.info(
                                "Pipecat: IVR/menu-like STT (%d chars), canned clarification — %r",
                                len(raw),
                                raw[:160],
                            )
                            canned = (
                                f"Sorry, I didn't catch that clearly — does your practice accept "
                                f"{carrier_hint} for behavioral health, and are you taking new patients?"
                            )
                            await self.push_frame(LLMFullResponseStartFrame())
                            await self.push_frame(LLMTextFrame(text=canned))
                            await self.push_frame(LLMFullResponseEndFrame())
                            return
                        self._history.append({"role": "user", "parts": [{"text": raw}]})
                        await self.push_frame(LLMFullResponseStartFrame())
                        model_id = settings.vertex_pipecat_llm_model
                        reply = ""
                        prev_stream_text = ""
                        try:
                            stream = await self._client.aio.models.generate_content_stream(
                                model=model_id,
                                contents=self._history,
                                config={"system_instruction": system_prompt},
                            )
                            async for chunk in stream:
                                full = chunk.text or ""
                                if not full:
                                    continue
                                if full.startswith(prev_stream_text):
                                    delta = full[len(prev_stream_text) :]
                                else:
                                    delta = full
                                    full = prev_stream_text + full
                                prev_stream_text = full
                                if delta:
                                    reply += delta
                                    await self.push_frame(LLMTextFrame(text=delta))
                        except Exception as exc:
                            logger.warning(
                                "Pipecat: streaming LLM failed (%s), falling back to non-streaming",
                                exc,
                            )
                            resp = await self._client.aio.models.generate_content(
                                model=model_id,
                                contents=self._history,
                                config={"system_instruction": system_prompt},
                            )
                            reply = (resp.text or "").strip()
                            if reply:
                                await self.push_frame(LLMTextFrame(text=reply))
                        reply = reply.strip()
                        if not reply:
                            logger.warning(
                                "Pipecat: Gemini returned empty reply; using fallback (user STT %r)",
                                raw[:120],
                            )
                            reply = (
                                f"I didn't quite hear that — do you accept {carrier_hint} "
                                "for behavioral health and are you accepting new patients?"
                            )
                            await self.push_frame(LLMTextFrame(text=reply))
                        self._history.append({"role": "model", "parts": [{"text": reply}]})
                        await self.push_frame(LLMFullResponseEndFrame())
                        farewell_phrases = ("have a great day", "goodbye", "take care", "bye")
                        has_farewell = any(p in reply.lower() for p in farewell_phrases)
                        # Don't hang up if Gemini is still asking a question in the same reply.
                        if reply and has_farewell and "?" not in reply:
                            await self.push_frame(EndFrame())
                    finally:
                        self._llm_in_progress = False
                else:
                    await self.push_frame(frame, direction)

        serializer = TwilioFrameSerializer(
            stream_sid=stream_sid,
            call_sid=call_sid,
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
        )
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                serializer=serializer,
            ),
        )
        vad = VADProcessor(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)))
        endpointing_opt: Any = (
            False if settings.deepgram_stt_endpointing_ms == 0 else settings.deepgram_stt_endpointing_ms
        )
        stt = DeepgramSTTService(
            api_key=settings.deepgram_api_key or "",
            sample_rate=settings.deepgram_stt_sample_rate,
            settings=DeepgramSTTService.Settings(
                model=settings.deepgram_stt_model,
                language=settings.deepgram_stt_language,
                smart_format=settings.deepgram_stt_smart_format,
                interim_results=settings.deepgram_stt_interim_results,
                utterance_end_ms=settings.deepgram_stt_utterance_end_ms,
                endpointing=endpointing_opt,
            ),
        )
        stt_commit = SttInterimCommitProcessor(
            commit_delay_ms=settings.voice_stt_interim_commit_delay_ms,
            min_chars=settings.voice_stt_interim_commit_min_chars,
            enabled=settings.voice_stt_interim_commit_enabled,
        )
        llm = _VertexLLMProcessor()
        tts_agg = (
            TextAggregationMode.SENTENCE
            if settings.deepgram_tts_text_aggregation == "sentence"
            else TextAggregationMode.TOKEN
        )
        tts = DeepgramTTSService(
            api_key=settings.deepgram_api_key or "",
            voice=settings.deepgram_tts_voice,
            sample_rate=settings.deepgram_tts_sample_rate,
            text_aggregation_mode=tts_agg,
        )
        _agent_debug_log(
            "twilio_audio_ws:deepgram_init",
            "Deepgram STT/TTS constructed",
            {
                "call_id": call_id,
                "stt_model": settings.deepgram_stt_model,
                "stt_sample_rate": settings.deepgram_stt_sample_rate,
                "tts_voice": settings.deepgram_tts_voice,
                "tts_sample_rate": settings.deepgram_tts_sample_rate,
                "tts_text_aggregation": settings.deepgram_tts_text_aggregation,
            },
            hypothesis_id="H_deepgram",
        )
        capture = TranscriptCapture()

        _audio_chunks_sent = [0]

        class AudioDebugLogger(FrameProcessor):
            async def process_frame(self, frame, direction: FrameDirection):  # type: ignore[override]
                await super().process_frame(frame, direction)
                fn = type(frame).__name__
                audio_len = len(frame.audio) if isinstance(frame, OutputAudioRawFrame) else None
                sr = getattr(frame, "sample_rate", None) if isinstance(frame, OutputAudioRawFrame) else None
                if isinstance(frame, OutputAudioRawFrame):
                    _audio_chunks_sent[0] += 1
                    if _audio_chunks_sent[0] <= 3:
                        _agent_debug_log(
                            "AudioDebugLogger:chunk",
                            fn,
                            {
                                "call_id": call_id,
                                "n": _audio_chunks_sent[0],
                                "audio_len": audio_len,
                                "sample_rate": sr,
                            },
                            hypothesis_id="H1_audio_frames",
                        )
                    if _audio_chunks_sent[0] == 1:
                        logger.info(
                            "AudioDebugLogger: first audio chunk call_id=%s bytes=%d sr=%d",
                            call_id, len(frame.audio), frame.sample_rate,
                        )
                await self.push_frame(frame, direction)

        audio_debug = AudioDebugLogger()

        pipeline = Pipeline(
            [
                transport.input(),
                vad,
                stt,
                stt_commit,
                llm,
                capture,
                tts,
                audio_debug,
                transport.output(),
            ]
        )
        opening_line = (
            f"Hi, I'm an AI assistant and this call is being recorded for directory accuracy purposes. "
            f"I'm calling on behalf of a new patient looking for behavioral health care — "
            f"does your practice currently accept {carrier_hint} insurance, and are you accepting new patients?"
        )

        task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

        @transport.event_handler("on_client_connected")
        async def on_connect(_transport, _client):  # type: ignore[misc]
            await task.queue_frames([
                LLMFullResponseStartFrame(),
                LLMTextFrame(text=opening_line),
                LLMFullResponseEndFrame(),
            ])

        @transport.event_handler("on_client_disconnected")
        async def on_disconnect(_transport, _client):  # type: ignore[misc]
            await task.queue_frame(EndFrame())

        runner = PipelineRunner()
        await runner.run(task)

        full_transcript = "\n".join(transcript_lines)
        logger.info("Pipecat WS closed for call_id=%s — transcript lines: %d", call_id, len(transcript_lines))
        npi = provider.npi if provider else call_id
        phone = provider.phone if provider else ""
        specialty = provider.specialty if provider else None
        status, ghost_reason, summary_text = classify_transcript(
            full_transcript,
            carrier_hint=carrier_hint,
            gcp_project=settings.google_cloud_project,
            vertex_location=settings.vertex_location,
        )
        logger.info(
            "Classifier call_id=%s → status=%s ghost_reason=%s",
            call_id, status, ghost_reason or "none",
        )
        result = CallResult(
            npi=npi,
            phone=phone,
            status=status,
            ghost_reason=ghost_reason,
            transcript=full_transcript or "[empty transcript]",
            summary=summary_text,
            provider_name=provider_name,
            specialty=specialty,
            verified_at=ts,
        )
        _resolve(result)

    except ImportError as exc:
        msg = f"Pipecat not installed: {exc}. Run: pip install -e '.[pipecat]'"
        logger.error(msg)
        result = CallResult(
            npi=provider.npi if provider else call_id,
            phone=provider.phone if provider else "",
            status="error",
            transcript=f"[{msg}]",
            summary="Pipecat deps missing.",
            provider_name=provider.name if provider else None,
            verified_at=ts,
        )
        _resolve(result)
    except Exception as exc:
        logger.exception("Pipecat pipeline error for call_id=%s", call_id)
        result = CallResult(
            npi=provider.npi if provider else call_id,
            phone=provider.phone if provider else "",
            status="error",
            transcript=f"[Pipeline error: {exc}]",
            summary="Pipeline error during call.",
            provider_name=provider.name if provider else None,
            verified_at=ts,
        )
        _resolve(result)


@app.post("/api/seed-demo")
async def seed_demo(request: Request, settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Seed a fixed 'demo' audit into the store so download endpoints work during demo replay."""
    from ghost_network_buster.models import AuditState, CallResult as CR  # noqa: PLC0415

    results = [
        CR(npi="1234567890", phone="212-555-0101", status="ghost", ghost_reason="disconnected",
           provider_name="Dr. Sarah Chen, LCSW", specialty="Anxiety, Trauma",
           transcript="Agent: Hi, I'm calling to verify if Dr. Sarah Chen accepts Aetna insurance and is accepting new patients for anxiety and trauma therapy.\n[Automated message: The number you have dialed has been disconnected or is no longer in service.]\nAgent: Logging result — disconnected number.",
           summary="Number disconnected. Provider unreachable.", verified_at="2026-05-02T10:01:00Z"),
        CR(npi="1234567891", phone="212-555-0102", status="ghost", ghost_reason="wrong_network",
           provider_name="Dr. Marcus Webb, PhD", specialty="CBT, Depression",
           transcript="Agent: Hi, I'm calling to verify whether Dr. Webb accepts Aetna insurance for outpatient therapy.\nReceptionist: Dr. Webb dropped Aetna back in 2023. He's cash-pay only now.\nAgent: Is he planning to rejoin any networks?\nReceptionist: No, I don't believe so.",
           summary="No longer in Aetna network since 2023.", verified_at="2026-05-02T10:02:30Z"),
        CR(npi="1234567892", phone="212-555-0103", status="ghost", ghost_reason="not_accepting_patients",
           provider_name="East Side Wellness Center", specialty="General Therapy",
           transcript="Agent: Good afternoon. I'm calling to confirm if you're accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: We're completely full. The waitlist has been closed since February — we don't know when we'll reopen it.\nAgent: Can you give any estimate on timeline?\nReceptionist: Honestly, no. I'd suggest looking elsewhere.",
           summary="Closed waitlist since February, no timeline to reopen.", verified_at="2026-05-02T10:04:00Z"),
        CR(npi="1234567893", phone="212-555-0104", status="real", ghost_reason=None,
           provider_name="Dr. Linda Okafor, LMFT", specialty="Trauma-Informed CBT",
           transcript="Agent: Hi, I'm calling to verify if Dr. Okafor is accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: Yes! Dr. Okafor is in-network with Aetna and we do have availability. She specializes in trauma-informed CBT.\nAgent: Can you confirm she's currently accepting new patients?\nReceptionist: Absolutely — openings as early as next week.",
           summary="Confirmed in-network, accepting new patients. Openings next week.", verified_at="2026-05-02T10:05:30Z"),
        CR(npi="1234567894", phone="212-555-0105", status="ghost", ghost_reason="wrong_provider",
           provider_name="Dr. James Ostrowski, PsyD", specialty="Behavioral Health",
           transcript="Agent: Hi, I'm trying to reach Dr. James Ostrowski at Midtown Behavioral Health.\nReceptionist: Dr. Ostrowski hasn't practiced here in over two years. We don't know where he relocated.\nAgent: Is there another Aetna-network therapist at this location?\nReceptionist: We don't have any Aetna providers on staff.",
           summary="Provider left practice 2+ years ago. Location has no Aetna coverage.", verified_at="2026-05-02T10:07:00Z"),
        CR(npi="1234567895", phone="212-555-0106", status="ghost", ghost_reason="no_behavioral_health",
           provider_name="Dr. Patricia Gonzalez, MD", specialty="Listed: Behavioral Health",
           transcript="Agent: I'm calling to confirm if Dr. Gonzalez provides behavioral health services and accepts Aetna for therapy.\nReceptionist: Dr. Gonzalez is an orthopedic surgeon. We don't offer any mental health services here.\nAgent: She's listed in Aetna's behavioral health directory — is that an error?\nReceptionist: That has to be a mistake. This is a surgical practice.",
           summary="Orthopedic surgeon, no behavioral health services. Directory listing is erroneous.", verified_at="2026-05-02T10:08:30Z"),
        CR(npi="1234567896", phone="212-555-0107", status="ghost", ghost_reason="retired",
           provider_name="Dr. Kevin Park, LCSW", specialty="Anxiety, PTSD",
           transcript="Agent: Good morning. I'm verifying whether Dr. Park is currently seeing patients and accepting Aetna for mental health therapy.\nReceptionist: Dr. Park retired in early 2024. This line is forwarded to billing only.\nAgent: Is there another provider at this location?\nReceptionist: The practice is closed. We're only handling final billing.",
           summary="Retired 2024. Practice closed.", verified_at="2026-05-02T10:10:00Z"),
        CR(npi="1234567897", phone="718-555-0108", status="real", ghost_reason=None,
           provider_name="Brooklyn Mind Collective", specialty="Anxiety, Trauma / PTSD",
           transcript="Agent: Hi, calling to confirm whether Brooklyn Mind Collective is accepting new Aetna patients for anxiety and trauma-focused therapy.\nReceptionist: Yes, we are! We have three therapists in-network with Aetna who specialize in anxiety and PTSD.\nAgent: Are they currently taking new patients?\nReceptionist: Two of them are — we can get someone in within two weeks.",
           summary="Confirmed in-network. 2 of 3 therapists accepting. Available within 2 weeks.", verified_at="2026-05-02T10:11:30Z"),
    ]
    state = AuditState(
        audit_id="demo",
        status="completed",
        providers_total=8,
        calls_completed=8,
        results=results,
        carrier="Aetna",
        zip_code="10001",
        care_needs=["Anxiety", "Trauma / PTSD"],
    )
    store: AuditStore = _get_store(request)
    store.cache_put(state)
    await store.save(state)
    return {"seeded": True, "audit_id": "demo"}


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
