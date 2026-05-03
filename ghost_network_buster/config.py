from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load `.env` from repo root so settings work regardless of process working directory.
_REPO_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    voice_provider: Literal["mock", "pipecat"] = "mock"
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
    # Live Pipecat turn uses streaming TTS; model id must exist in vertex_location for your project.
    vertex_pipecat_llm_model: str = "gemini-2.5-flash"

    # Pipecat / open-source voice (used when VOICE_PROVIDER=pipecat)
    public_url: str | None = None          # ngrok or Cloud Run URL, no trailing slash
    deepgram_api_key: str | None = None    # free 10K min/month at deepgram.com
    # Deepgram STT (LiveOptions) — tuned for Twilio 8 kHz mono media streams
    # Streaming STT model must be a full Deepgram model id (e.g. nova-3-general, nova-2-general).
    # Bare "nova-2" can cause HTTP 400 on WebSocket connect.
    deepgram_stt_model: str = "nova-3-general"
    deepgram_stt_language: str = "en-US"
    deepgram_stt_sample_rate: int = Field(default=8000, ge=8000, le=48000)
    deepgram_stt_utterance_end_ms: int = Field(default=1200, ge=100, le=5000)
    deepgram_stt_smart_format: bool = True
    deepgram_stt_interim_results: bool = True
    # Endpointing: Deepgram accepts ms (e.g. 300) or boolean; 0 = omit (API default)
    deepgram_stt_endpointing_ms: int = Field(default=550, ge=0, le=10000)
    # Deepgram TTS (Twilio output is resampled to 8 kHz µ-law in the serializer)
    deepgram_tts_voice: str = "aura-2-helena-en"
    deepgram_tts_sample_rate: int = Field(default=24000, ge=8000, le=48000)
    # sentence = fewer, larger TTS chunks (smoother on phones); token = lowest latency between chunks
    deepgram_tts_text_aggregation: Literal["sentence", "token"] = "sentence"

    # After VAD stop, if Deepgram never emits a final (common on very short utterances), promote the
    # last interim transcript to a synthetic TranscriptionFrame after this delay.
    voice_stt_interim_commit_enabled: bool = True
    voice_stt_interim_commit_delay_ms: int = Field(default=750, ge=0, le=3000)
    voice_stt_interim_commit_min_chars: int = Field(default=2, ge=1, le=32)
    # Log raw Deepgram interim + final lines to server stdout (dev / QA). May contain PHI — off in prod.
    voice_stt_trace_enabled: bool = False
    # Silero VAD (Pipecat): short stop_secs causes many user-stopped events mid-phrase on phone audio,
    # which fragments Deepgram utterances. Tune for Twilio 8 kHz if you see VAD spam but no STT.
    voice_vad_stop_secs: float = Field(default=0.85, ge=0.15, le=2.0)
    voice_vad_start_secs: float = Field(default=0.2, ge=0.05, le=1.0)

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

    # When True, POST /api/start-audit runs the Google ADK root agent (directory → voice →
    # classify → RAG → synthesizer). When False, uses the legacy asyncio pipeline only.
    use_adk_audit: bool = False

    # If True and VOICE_PROVIDER=pipecat, the ADK graph re-runs ac_classify_transcript on each
    # result after calls (extra Vertex cost). Default False: trust inline Pipecat classification.
    adk_reclassify_after_pipecat: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
