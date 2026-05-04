from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Provider(BaseModel):
    npi: str
    name: str
    phone: str
    specialty: str | None = None
    # Optional postal code — surfaced on results cards for realism. Not used
    # for filtering (audits use specialty/care-need overlap only).
    zip: str | None = None
    # When VOICE_PROVIDER=mock, drives the fake transcript/outcome (optional).
    # When omitted, MockVoiceProvider draws an outcome at random using the
    # mock_voice_real_share setting.
    mock_outcome: (
        Literal[
            "real",
            "ghost_disconnected",
            "ghost_wrong_network",
            "ghost_not_accepting_patients",
            "ghost_no_behavioral_health",
            "ghost_retired",
            "ghost_wrong_provider",
            "voicemail",
        ]
        | None
    ) = None


class CallResult(BaseModel):
    npi: str
    phone: str
    status: Literal["real", "ghost", "voicemail", "no_answer", "error"]
    ghost_reason: str | None = None
    transcript: str
    summary: str | None = None
    provider_name: str | None = None
    specialty: str | None = None
    zip: str | None = None
    verified_at: str | None = None
    audio_note: str | None = Field(
        default=None,
        description="In mock mode: no recording; live Pipecat/Twilio mode may hold a recording URL.",
    )


class AuditState(BaseModel):
    audit_id: str
    status: Literal["running", "completed", "failed"] = "running"
    providers_total: int = 0
    calls_completed: int = 0
    results: list[CallResult] = Field(default_factory=list)
    error: str | None = None
    carrier: str = "Aetna"
    zip_code: str = ""
    care_needs: list[str] = Field(default_factory=list)
    email: str | None = None
    loop_agent_note: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    plan_type: str | None = None
    member_plan_label: str | None = None
    recording_consent: bool = False
    terms_acknowledged: bool = False
    # Populated by ADK audit graph (RAG + synthesizer LlmAgents) for complaint alignment
    adk_regulatory_bullets: str | None = None
    adk_letter_body: str | None = None


class AuditSummary(BaseModel):
    """Computed deliverable-friendly view for the UI."""

    audit_id: str
    status: Literal["running", "completed", "failed"]
    carrier: str
    zip_code: str
    care_needs: list[str]
    plan_type: str | None = None
    member_plan_label: str | None = None
    recording_consent: bool = False
    terms_acknowledged: bool = False
    started_at: str | None = None
    completed_at: str | None = None
    providers_total: int
    calls_completed: int
    ghost_count: int
    real_count: int
    voicemail_count: int
    other_count: int
    ghost_rate: float
    voicemail_rate: float
    high_ghost_rate: bool
    complaint_eligible: bool
    top_providers: list[CallResult]
    results: list[CallResult]
    error: str | None = None
    share_path: str
    voice_mode: str
    loop_agent_note: str | None = None
    rag_hits: list[dict[str, object]] = Field(default_factory=list)
