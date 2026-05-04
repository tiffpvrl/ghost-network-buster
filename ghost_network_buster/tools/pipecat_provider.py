"""
Pipecat + Twilio voice provider (open-source, free-tier friendly).

Setup:
  1. Twilio trial account (personal email OK, $15 free credit):
       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
  2. Deepgram free tier (10K min/month): DEEPGRAM_API_KEY
  3. Gemini free tier (Google AI Studio): GEMINI_API_KEY
  4. Public URL for webhooks (ngrok in dev): PUBLIC_URL

Install extra deps: pip install -e ".[pipecat]"
Switch voice: VOICE_PROVIDER=pipecat in .env
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import httpx

from ghost_network_buster.models import CallResult, Provider

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Shared state: call_id → asyncio.Future[CallResult]
_PENDING_CALLS: dict[str, asyncio.Future[CallResult]] = {}
# call_id → {"provider": Provider, "carrier_hint": str}
_CALL_META: dict[str, dict] = {}


class PipecatVoiceProvider:
    """
    Initiates outbound calls via Twilio REST API; Pipecat pipeline handles
    the conversation over a WebSocket stream once the call is answered.
    The WebSocket endpoint in main.py resolves the future with a real CallResult.
    """

    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        from_number: str,
        public_url: str,
        deepgram_api_key: str,
    ) -> None:
        self._account_sid = account_sid
        self._auth_token = auth_token
        self._from_number = from_number
        self._public_url = public_url.rstrip("/")
        self._deepgram_api_key = deepgram_api_key

    async def call_provider(
        self,
        provider: Provider,
        *,
        carrier_hint: str = "Aetna",
        care_needs: list[str] | None = None,
    ) -> CallResult:
        call_id = str(uuid.uuid4())
        loop = asyncio.get_event_loop()
        future: asyncio.Future[CallResult] = loop.create_future()
        _PENDING_CALLS[call_id] = future
        _CALL_META[call_id] = {"provider": provider, "carrier_hint": carrier_hint, "care_needs": care_needs or []}

        answer_url = f"{self._public_url}/webhook/twilio/answer/{call_id}"
        ts = datetime.now(timezone.utc).isoformat()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{self._account_sid}/Calls.json",
                    auth=(self._account_sid, self._auth_token),
                    data={
                        "From": self._from_number,
                        "To": provider.phone,
                        "Url": answer_url,
                        "Method": "POST",
                        "StatusCallbackMethod": "POST",
                        "Timeout": "30",
                    },
                )
            if resp.status_code >= 400:
                _PENDING_CALLS.pop(call_id, None)
                _CALL_META.pop(call_id, None)
                raise RuntimeError(
                    f"Twilio API error {resp.status_code}: {resp.text[:400]}"
                )
            logger.info("Twilio call placed for NPI %s (call_id=%s)", provider.npi, call_id)
        except Exception as exc:
            _PENDING_CALLS.pop(call_id, None)
            _CALL_META.pop(call_id, None)
            return CallResult(
                npi=provider.npi,
                phone=provider.phone,
                status="error",
                transcript=f"[Twilio initiation error: {exc}]",
                summary="Call could not be placed.",
                provider_name=provider.name,
                specialty=provider.specialty,
                verified_at=ts,
            )

        try:
            result = await asyncio.wait_for(future, timeout=120.0)
        except asyncio.TimeoutError:
            logger.warning("Call timed out for NPI %s (call_id=%s)", provider.npi, call_id)
            result = CallResult(
                npi=provider.npi,
                phone=provider.phone,
                status="no_answer",
                transcript="[No answer or pipeline timeout after 120s]",
                summary="No answer within timeout.",
                provider_name=provider.name,
                specialty=provider.specialty,
                verified_at=ts,
            )
        finally:
            _PENDING_CALLS.pop(call_id, None)
            _CALL_META.pop(call_id, None)

        return result
