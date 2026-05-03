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


# ── Mock outcome catalogue ────────────────────────────────────────────────
#
# Outcome ids match the Provider.mock_outcome literal. Each entry carries a
# weight (used when no `mock_outcome` is set on the fixture row) plus a small
# transcript / summary template. The frontend's labels.ts already knows the
# resulting `ghost_reason` values, so the dashboard surfaces them with friendly
# copy automatically.

_MOCK_OUTCOMES: tuple[str, ...] = (
    "real",
    "ghost_disconnected",
    "ghost_wrong_network",
    "ghost_not_accepting_patients",
    "ghost_no_behavioral_health",
    "ghost_retired",
    "ghost_wrong_provider",
    "voicemail",
)

# Weights used when mock_voice_real_share governs the real/ghost split. The
# ghost-flavour weights are normalised separately so the per-flavour ratio
# stays stable when the user tunes the real share.
_GHOST_FLAVOUR_WEIGHTS: dict[str, float] = {
    "ghost_disconnected": 0.20,
    "ghost_wrong_network": 0.22,
    "ghost_not_accepting_patients": 0.18,
    "ghost_no_behavioral_health": 0.12,
    "ghost_retired": 0.10,
    "ghost_wrong_provider": 0.10,
    "voicemail": 0.08,
}


def _pick_outcome(rng: random.Random, real_share: float) -> str:
    """Pick a synthetic outcome honouring the configured real/ghost split."""
    real_share = max(0.0, min(1.0, real_share))
    if rng.random() < real_share:
        return "real"
    flavours = list(_GHOST_FLAVOUR_WEIGHTS.items())
    weights = [w for _, w in flavours]
    return rng.choices([name for name, _ in flavours], weights=weights, k=1)[0]


def _carrier_hint(carrier: str | None) -> str:
    return carrier.strip() if (carrier and carrier.strip()) else "this plan"


def _real_transcript(name: str, carrier: str) -> str:
    return (
        f"Agent: Hi, calling to confirm whether {name} accepts {carrier} for "
        f"outpatient behavioral health.\n"
        f"Reception: Yes — we are in-network with {carrier} and we are taking "
        f"new patients.\n"
        f"Agent: Roughly how soon could you schedule?\n"
        f"Reception: We can usually book a first appointment within one to two "
        f"weeks, virtual or in-person.\n"
    )


def _real_summary(carrier: str) -> str:
    return (
        f"Confirmed in-network with {carrier}. Accepting new patients with "
        f"availability in roughly 1–2 weeks."
    )


def _ghost_transcript(outcome: str, name: str, carrier: str) -> str:
    base = (
        f"Agent: Hi, calling to verify whether {name} is in-network with "
        f"{carrier} and accepting new patients.\n"
    )
    if outcome == "ghost_disconnected":
        return (
            f"{base}[Automated message: The number you have dialed has been "
            f"disconnected or is no longer in service.]\n"
            f"Agent: Logging result — disconnected line."
        )
    if outcome == "ghost_wrong_network":
        return (
            f"{base}Reception: We dropped {carrier} a while back — we are cash-pay "
            f"or out-of-network now.\n"
            f"Agent: Any plan to rejoin networks soon?\n"
            f"Reception: Not that I know of.\n"
        )
    if outcome == "ghost_not_accepting_patients":
        return (
            f"{base}Reception: We are full. The waitlist has been closed for "
            f"months and we don't have a reopen date.\n"
            f"Agent: Anyone else in the practice taking new {carrier} patients?\n"
            f"Reception: I'm afraid not.\n"
        )
    if outcome == "ghost_no_behavioral_health":
        return (
            f"{base}Reception: This office doesn't actually provide behavioral "
            f"health services — that's a directory mix-up.\n"
            f"Agent: They're listed in the {carrier} behavioral directory. Is "
            f"there a different number for that team?\n"
            f"Reception: There isn't — it's just us here.\n"
        )
    if outcome == "ghost_retired":
        return (
            f"{base}Reception: They retired some time ago. This number forwards "
            f"to the billing line only.\n"
            f"Agent: Is anyone covering the panel?\n"
            f"Reception: No, the panel was closed.\n"
        )
    if outcome == "ghost_wrong_provider":
        return (
            f"{base}Reception: That clinician hasn't practiced from this office "
            f"in over two years — we don't have forwarding info.\n"
            f"Agent: Anyone in-network with {carrier} on staff today?\n"
            f"Reception: No, we don't have any {carrier} providers here.\n"
        )
    return base  # pragma: no cover — outcome filtered upstream


def _ghost_summary(outcome: str, carrier: str) -> str:
    if outcome == "ghost_disconnected":
        return "Number disconnected. Provider unreachable."
    if outcome == "ghost_wrong_network":
        return f"Practice reports they no longer accept {carrier}."
    if outcome == "ghost_not_accepting_patients":
        return "Closed waitlist; no reopen timeline shared."
    if outcome == "ghost_no_behavioral_health":
        return "Listed in directory but does not offer behavioral health services."
    if outcome == "ghost_retired":
        return "Provider retired; line forwarded to billing only."
    if outcome == "ghost_wrong_provider":
        return "Provider left practice over a year ago; no forwarding info."
    return ""  # pragma: no cover


_GHOST_REASON_BY_OUTCOME: dict[str, str] = {
    "ghost_disconnected": "disconnected",
    "ghost_wrong_network": "wrong_network",
    "ghost_not_accepting_patients": "not_accepting_patients",
    "ghost_no_behavioral_health": "no_behavioral_health",
    "ghost_retired": "retired",
    "ghost_wrong_provider": "wrong_provider",
}

# Returned in CallResult.audio_note instead of the fixture's phone number, so
# leftover real numbers in fixtures never reach the UI in mock mode.
_MOCK_AUDIO_NOTE = (
    "Mock mode: no audio recording. With Pipecat/Twilio, a real call recording "
    "URL would appear here."
)
# Public synthetic phone shown in the dashboard "phone on file" line. Real
# numbers from fixtures are never echoed back.
_MOCK_PHONE_DISPLAY = "+1 (212) 555-0100"


class MockVoiceProvider(VoiceProvider):
    """Simulates a behavioral-health verification call.

    The pacing is settings-driven so the deployed UX feels like a real audit
    (defaults: 6–9 s per call). Phone numbers from the fixture are never
    written into the transcript or the returned CallResult — instead a synthetic
    placeholder is used. This guarantees that even if a fixture leaks a real
    number, mock mode never surfaces it to the UI.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def call_provider(
        self,
        provider: Provider,
        *,
        carrier_hint: str = "Aetna",
    ) -> CallResult:
        rng = random.Random()
        delay_min = getattr(self._settings, "mock_voice_delay_min_s", 0.08) if self._settings else 0.08
        delay_max = getattr(self._settings, "mock_voice_delay_max_s", 0.35) if self._settings else 0.35
        if delay_max < delay_min:
            delay_max = delay_min
        await asyncio.sleep(rng.uniform(delay_min, delay_max))

        real_share = (
            getattr(self._settings, "mock_voice_real_share", 0.35)
            if self._settings
            else 0.35
        )
        outcome: str = provider.mock_outcome or _pick_outcome(rng, real_share)
        if outcome not in _MOCK_OUTCOMES:
            outcome = _pick_outcome(rng, real_share)

        carrier = _carrier_hint(carrier_hint)
        ts = datetime.now(timezone.utc).isoformat()
        name = provider.name
        spec = provider.specialty

        if outcome == "real":
            return CallResult(
                npi=provider.npi,
                phone=_MOCK_PHONE_DISPLAY,
                status="real",
                transcript=_real_transcript(name, carrier),
                summary=_real_summary(carrier),
                provider_name=name,
                specialty=spec,
                verified_at=ts,
                audio_note=_MOCK_AUDIO_NOTE,
            )

        if outcome == "voicemail":
            transcript = (
                f"Agent: Hi, calling to verify whether {name} is in-network with "
                f"{carrier}.\n"
                "[Voicemail greeting] You've reached the office of [practice]. "
                "Please leave a message after the tone.\n[Beep]\n"
                "Agent: Logging result — voicemail; no live confirmation."
            )
            return CallResult(
                npi=provider.npi,
                phone=_MOCK_PHONE_DISPLAY,
                status="voicemail",
                transcript=transcript,
                summary="Voicemail; no live confirmation of network status.",
                provider_name=name,
                specialty=spec,
                verified_at=ts,
                audio_note=_MOCK_AUDIO_NOTE,
            )

        # Ghost branch
        return CallResult(
            npi=provider.npi,
            phone=_MOCK_PHONE_DISPLAY,
            status="ghost",
            ghost_reason=_GHOST_REASON_BY_OUTCOME[outcome],
            transcript=_ghost_transcript(outcome, name, carrier),
            summary=_ghost_summary(outcome, carrier),
            provider_name=name,
            specialty=spec,
            verified_at=ts,
            audio_note=_MOCK_AUDIO_NOTE,
        )


def get_voice_provider(settings: Settings) -> VoiceProvider:
    if settings.voice_provider == "mock":
        return MockVoiceProvider(settings)
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
