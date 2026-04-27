from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    voice_provider: Literal["mock", "retell", "pipecat"] = "mock"
    retell_api_key: str | None = None
    retell_agent_id: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    demo_api_key: str | None = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # GCP (optional — set on Cloud Run)
    google_cloud_project: str | None = Field(default=None, validation_alias="GOOGLE_CLOUD_PROJECT")
    gcs_audits_bucket: str | None = None
    gcs_audits_prefix: str = "audits/"
    gcs_memory_bucket: str | None = None
    gcs_memory_prefix: str = "npi_memory/"

    # Vertex AI (used for Gemini LLM — complaint draft + Pipecat pipeline)
    vertex_location: str = "us-central1"   # Vertex AI region

    # Pipecat / open-source voice (used when VOICE_PROVIDER=pipecat)
    public_url: str | None = None          # ngrok or Cloud Run URL, no trailing slash
    deepgram_api_key: str | None = None    # free 10K min/month at deepgram.com
    # Cost guard: pipecat audits with more providers than this are rejected unless
    # the request includes "override_cost_guard": true. Set to 0 to disable.
    pipecat_cost_guard: int = Field(default=5, ge=0)

    # Local persistence (relative to repo root unless absolute)
    audit_local_dir: str | None = "data/audits"
    memory_local_dir: str | None = "data/memory_npi"

    max_parallel_calls: int = Field(default=5, ge=1, le=50)
    loop_reverify_voicemail: bool = True
    loop_ghost_rate_threshold: float = Field(default=0.9, ge=0.0, le=1.0)

    # Provider directory JSON (relative to repo root unless absolute)
    providers_data_file: str = "data/providers_sample.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
