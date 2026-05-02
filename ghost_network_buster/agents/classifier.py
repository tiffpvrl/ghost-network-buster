"""Hybrid transcript classification: keyword fast-path + Gemini LLM fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Literal

logger = logging.getLogger(__name__)

Status = Literal["real", "ghost", "voicemail", "no_answer", "error"]


# ---------------------------------------------------------------------------
# Keyword fast-path (high-confidence signals only)
# ---------------------------------------------------------------------------

def _keyword_classify(t: str, carrier_hint: str) -> tuple[Status, str | None, str] | None:
    """
    Returns a result only when a signal is unambiguous.
    Returns None to indicate the LLM fallback should run.
    """
    if "voicemail" in t or "[beep]" in t or "leave a message" in t:
        return "voicemail", None, "Voicemail; no human confirmation."
    if "dial tone" in t or "not in service" in t or "disconnected" in t:
        return "ghost", "disconnected", "Line disconnected or not in service."
    return None  # ambiguous — defer to LLM


# ---------------------------------------------------------------------------
# Gemini LLM fallback
# ---------------------------------------------------------------------------

_CLASSIFICATION_PROMPT = """You are an expert at analyzing phone call transcripts between an AI auditor and a medical practice receptionist.

The auditor is verifying whether the practice accepts {carrier} insurance for behavioral health services and is accepting new patients.

Transcript:
<transcript>
{transcript}
</transcript>

Classify the outcome using EXACTLY one of these statuses:
- "real"      — practice confirmed they accept {carrier} for behavioral health and are taking new patients
- "ghost"     — practice is listed in the {carrier} directory but is effectively inaccessible (see ghost_reason)
- "voicemail" — reached voicemail or answering machine; no human confirmed anything
- "no_answer" — call unanswered, or transcript too short/unclear to determine outcome

If status is "ghost", set ghost_reason to EXACTLY one of:
- "disconnected"           — number not in service, dead line, or rings with no answer
- "wrong_network"          — practice confirmed they do not accept {carrier} (dropped contract, never accepted, out of network)
- "no_behavioral_health"   — practice accepts {carrier} but does NOT offer behavioral health / mental health services
- "not_accepting_patients" — practice accepts {carrier} for behavioral health but is closed to new patients
- "wrong_provider"         — number belongs to a completely different practice or individual than listed
- "retired"                — provider is retired, deceased, or no longer practicing at this location
- "wrong_specialty"        — listed as behavioral health but practice confirmed a different specialty
- "referral_only"          — practice requires a referral not disclosed in the directory, creating an access barrier

Otherwise set ghost_reason to null.

Write a concise 1-sentence summary describing what happened on the call.

IMPORTANT: The transcript may contain speech-to-text errors (e.g. carrier name garbled as "eight now" instead of "Aetna"). Use context to interpret intent.

Respond with ONLY valid JSON, no markdown fences:
{{"status": "...", "ghost_reason": "...", "summary": "..."}}"""


def _llm_classify(
    transcript: str,
    carrier_hint: str,
    gcp_project: str | None,
    vertex_location: str = "us-central1",
) -> tuple[Status, str | None, str]:
    """Call Gemini Flash to classify the transcript. Falls back to no_answer on any error."""
    if not gcp_project or not transcript.strip():
        return "no_answer", None, "Could not classify transcript (no GCP project or empty transcript)."

    try:
        from google import genai  # type: ignore[import-untyped]

        client = genai.Client(vertexai=True, project=gcp_project, location=vertex_location)
        prompt = _CLASSIFICATION_PROMPT.format(
            carrier=carrier_hint,
            transcript=transcript,
        )
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        raw = (resp.text or "").strip()
        # Strip markdown fences if model adds them
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
        data = json.loads(raw)

        status = data.get("status", "no_answer")
        if status not in ("real", "ghost", "voicemail", "no_answer", "error"):
            status = "no_answer"

        ghost_reason = data.get("ghost_reason") or None
        summary = data.get("summary") or "LLM classification produced no summary."
        logger.info("LLM classifier → status=%s ghost_reason=%s", status, ghost_reason)
        return status, ghost_reason, summary  # type: ignore[return-value]

    except Exception as exc:
        logger.warning("LLM classifier failed (%s), falling back to no_answer", exc)
        return "no_answer", None, "Could not classify transcript."


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def classify_transcript(
    transcript: str,
    *,
    carrier_hint: str = "Aetna",
    gcp_project: str | None = None,
    vertex_location: str = "us-central1",
) -> tuple[Status, str | None, str]:
    """
    Hybrid classifier:
      1. Keyword fast-path for high-confidence signals (voicemail, disconnected).
      2. Gemini Flash LLM for everything else.
      3. Falls back to no_answer if LLM is unavailable.
    """
    t = (transcript or "").lower()

    keyword_result = _keyword_classify(t, carrier_hint)
    if keyword_result is not None:
        return keyword_result

    return _llm_classify(transcript, carrier_hint, gcp_project, vertex_location)
