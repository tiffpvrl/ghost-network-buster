from typing import Literal

from pydantic import BaseModel, Field


class Provider(BaseModel):
    npi: str
    name: str
    phone: str
    specialty: str | None = None
    # When VOICE_PROVIDER=mock, drives fake transcript/outcome (optional).
    mock_outcome: Literal["real", "ghost_disconnected", "ghost_wrong_network", "voicemail"] | None = (
        None
    )


class CallResult(BaseModel):
    npi: str
    phone: str
    status: Literal["real", "ghost", "voicemail", "no_answer", "error"]
    ghost_reason: str | None = None
    transcript: str
    summary: str | None = None
    provider_name: str | None = None
    specialty: str | None = None
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


class AuditSummary(BaseModel):
    """Computed deliverable-friendly view for the UI."""

    audit_id: str
    status: Literal["running", "completed", "failed"]
    carrier: str
    zip_code: str
    care_needs: list[str]
    providers_total: int
    calls_completed: int
    ghost_count: int
    real_count: int
    voicemail_count: int
    other_count: int
    ghost_rate: float
    voicemail_rate: float
    complaint_eligible: bool
    top_providers: list[CallResult]
    results: list[CallResult]
    share_path: str
    voice_mode: str
    loop_agent_note: str | None = None
    rag_hits: list[dict[str, object]] = Field(default_factory=list)
