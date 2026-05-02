"""Voice integration: mock (free dev) and Pipecat/Twilio."""

from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from ghost_network_buster.models import CallResult, Provider

if TYPE_CHECKING:
    from ghost_network_buster.config import Settings


class VoiceConfigurationError(RuntimeError):
    """Raised when live voice is selected but credentials are missing."""


class VoiceProvider(ABC):
    """One outbound attempt → structured CallResult."""

    @abstractmethod
    async def call_provider(
        self,
        provider: Provider,
        *,
        carrier_hint: str = "Aetna",
    ) -> CallResult:
        ...


class MockVoiceProvider(VoiceProvider):
    """Simulates latency + transcripts. No telephony cost."""

    async def call_provider(
        self,
        provider: Provider,
        *,
        carrier_hint: str = "Aetna",
    ) -> CallResult:
        await asyncio.sleep(random.uniform(0.08, 0.35))
        outcome = provider.mock_outcome or random.choice(
            ["real", "ghost_disconnected", "ghost_wrong_network", "voicemail"]
        )
        name = provider.name
        spec = provider.specialty
        ts = datetime.now(timezone.utc).isoformat()
        mock_audio = (
            "Mock mode: no audio file. With Pipecat/Twilio, a real call recording URL could appear here."
        )
        if outcome == "real":
            transcript = (
                f"Reception: {name}, how can I help?\n"
                f"Agent: Hi — is the practice accepting new therapy patients with {carrier_hint}?\n"
                f"Reception: Yes, we are. Next opening is in about a week, virtual or in-person.\n"
            )
            return CallResult(
                npi=provider.npi,
                phone=provider.phone,
                status="real",
                transcript=transcript,
                summary="Accepting new patients; next opening ~1 week.",
                provider_name=name,
                specialty=spec,
                verified_at=ts,
                audio_note=mock_audio,
            )
        if outcome == "ghost_disconnected":
            return CallResult(
                npi=provider.npi,
                phone=provider.phone,
                status="ghost",
                ghost_reason="disconnected",
                transcript="[Dial tone / number not in service]",
                summary="Line disconnected or not in service.",
                provider_name=name,
                specialty=spec,
                verified_at=ts,
                audio_note=mock_audio,
            )
        if outcome == "ghost_wrong_network":
            transcript = (
                f"Reception: {name}.\n"
                f"Agent: Do you accept {carrier_hint} for behavioral health?\n"
                f"Reception: We haven't taken {carrier_hint} in years — we're out of network.\n"
            )
            return CallResult(
                npi=provider.npi,
                phone=provider.phone,
                status="ghost",
                ghost_reason="wrong_network",
                transcript=transcript,
                summary=f"Practice reports not in network for {carrier_hint}.",
                provider_name=name,
                specialty=spec,
                verified_at=ts,
                audio_note=mock_audio,
            )
        transcript = (
            "You've reached the voicemail of [practice]. Please leave a message.\n[Beep]"
        )
        return CallResult(
            npi=provider.npi,
            phone=provider.phone,
            status="voicemail",
            transcript=transcript,
            summary="Voicemail; no human confirmation.",
            provider_name=name,
            specialty=spec,
            verified_at=ts,
            audio_note=mock_audio,
        )


def get_voice_provider(settings: Settings) -> VoiceProvider:
    if settings.voice_provider == "mock":
        return MockVoiceProvider()
    if settings.voice_provider == "pipecat":
        from ghost_network_buster.tools.pipecat_provider import PipecatVoiceProvider  # noqa: PLC0415

        missing = [
            name
            for name, val in [
                ("TWILIO_ACCOUNT_SID", settings.twilio_account_sid),
                ("TWILIO_AUTH_TOKEN", settings.twilio_auth_token),
                ("TWILIO_FROM_NUMBER", settings.twilio_from_number),
                ("PUBLIC_URL", settings.public_url),
                ("DEEPGRAM_API_KEY", settings.deepgram_api_key),
                ("GOOGLE_CLOUD_PROJECT", settings.google_cloud_project),
            ]
            if not val
        ]
        if missing:
            raise VoiceConfigurationError(
                f"VOICE_PROVIDER=pipecat requires: {', '.join(missing)}. "
                "See .env.example for setup instructions."
            )
        return PipecatVoiceProvider(
            account_sid=settings.twilio_account_sid,  # type: ignore[arg-type]
            auth_token=settings.twilio_auth_token,  # type: ignore[arg-type]
            from_number=settings.twilio_from_number,  # type: ignore[arg-type]
            public_url=settings.public_url,  # type: ignore[arg-type]
            deepgram_api_key=settings.deepgram_api_key,  # type: ignore[arg-type]
        )
    raise VoiceConfigurationError(
        f"Unknown VOICE_PROVIDER={settings.voice_provider!r}. Use mock or pipecat. See .env.example."
    )


_TWILIO_NOTE = """
Twilio is not invoked in mock mode.

For Pipecat:
1. Buy a voice-capable number in Twilio Console and use it as TWILIO_FROM_NUMBER.
2. Set PUBLIC_URL to your HTTPS ngrok or Cloud Run URL so Twilio can reach webhooks.
3. Store TWILIO_* in Secret Manager for Cloud Run.

Reserved env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
""".strip()


def twilio_placeholder_note() -> str:
    return _TWILIO_NOTE
