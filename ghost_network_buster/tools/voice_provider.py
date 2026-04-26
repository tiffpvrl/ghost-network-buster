"""
Voice integration: mock (free dev) and Retell + Twilio placeholders.

Swap VOICE_PROVIDER=retell when you have RETELL_API_KEY, RETELL_AGENT_ID, and billing.
Twilio is typically used for purchasing/mapping phone numbers; wire it when Retell docs
require a Twilio-backed number.
"""

from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

import httpx

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
    """Simulates latency + transcripts. No Retell/Twilio cost."""

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
        mock_audio = "Mock mode: no audio file. With Retell, a 10-15s verification clip would appear here."
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


class RetellVoiceProvider(VoiceProvider):
    """
    Placeholder for Retell outbound calls.

    When keys are set, performs a minimal create-phone-call request so you can verify
    connectivity. Full transcript handling should use Retell webhooks + your DB/GCS.

    Docs: https://docs.retellai.com/
    """

    def __init__(self, api_key: str, agent_id: str, base_url: str = "https://api.retellai.com") -> None:
        self._api_key = api_key
        self._agent_id = agent_id
        self._base_url = base_url.rstrip("/")

    async def call_provider(
        self,
        provider: Provider,
        *,
        carrier_hint: str = "Aetna",
    ) -> CallResult:
        """
        Starts an outbound call via Retell REST API.

        NOTE: Real pipelines poll webhooks or the call object for transcripts; this stub
        returns a single placeholder CallResult so FastAPI can run without webhook setup.
        Replace with webhook-driven classification in production.
        """
        url = f"{self._base_url}/v2/create-phone-call"
        payload = {
            "agent_id": self._agent_id,
            "to_number": provider.phone,
            "metadata": {
                "npi": provider.npi,
                "carrier_hint": carrier_hint,
                "provider_name": provider.name,
            },
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"Retell API error {resp.status_code}: {resp.text[:500]}. "
                "Check agent_id, number format E.164, and account billing."
            )
        data = resp.json()
        call_id = data.get("call_id", data.get("callId", str(uuid.uuid4())))
        ts = datetime.now(timezone.utc).isoformat()
        return CallResult(
            npi=provider.npi,
            phone=provider.phone,
            status="no_answer",
            transcript=(
                f"[Retell call started: {call_id}]. "
                "Wire webhooks to capture live transcript and replace this stub."
            ),
            summary="Retell call placed; await webhook for final classification.",
            provider_name=provider.name,
            specialty=provider.specialty,
            verified_at=ts,
            audio_note=None,
        )


def get_voice_provider(settings: Settings) -> VoiceProvider:
    if settings.voice_provider == "mock":
        return MockVoiceProvider()
    if not settings.retell_api_key or not settings.retell_agent_id:
        raise VoiceConfigurationError(
            "VOICE_PROVIDER=retell requires RETELL_API_KEY and RETELL_AGENT_ID. "
            "Use VOICE_PROVIDER=mock for free development, or add keys to .env."
        )
    return RetellVoiceProvider(settings.retell_api_key, settings.retell_agent_id)


_TWILIO_NOTE = """
Twilio is not invoked in mock mode.

Typical later steps:
1. Buy a voice-capable number in Twilio Console.
2. Connect that number to Retell per Retell's Twilio integration docs.
3. Store TWILIO_* in Secret Manager for Cloud Run.

Reserved env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
""".strip()


def twilio_placeholder_note() -> str:
    return _TWILIO_NOTE
