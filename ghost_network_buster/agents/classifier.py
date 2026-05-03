"""Hybrid transcript classification: keyword fast-path + ADK LlmAgent (Vertex)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Literal

from ghost_network_buster.adk_blueprint import build_classifier_agent, run_agent_async

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
# ADK LlmAgent (shared instruction with adk_blueprint.classifier_agent)
# ---------------------------------------------------------------------------

def _parse_llm_classifier_json(raw: str) -> tuple[Status, str | None, str]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()
    data = json.loads(cleaned)

    status = data.get("status", "no_answer")
    if status not in ("real", "ghost", "voicemail", "no_answer", "error"):
        status = "no_answer"

    ghost_reason = data.get("ghost_reason") or None
    summary = data.get("summary") or "LLM classification produced no summary."
    logger.info("ADK classifier → status=%s ghost_reason=%s", status, ghost_reason)
    return status, ghost_reason, summary  # type: ignore[return-value]


async def ac_classify_transcript(
    transcript: str,
    *,
    carrier_hint: str = "Aetna",
    gcp_project: str | None = None,
    vertex_location: str = "us-central1",
) -> tuple[Status, str | None, str]:
    """
    Classify a call transcript using keyword rules, then the ADK classifier LlmAgent on Vertex.

    Ensures ADK/Vertex env vars are present via setdefault (idempotent; safe with lifespan defaults).
    """
    if not (transcript or "").strip():
        return "no_answer", None, "Could not classify transcript (empty transcript)."

    t = transcript.lower()
    keyword_result = _keyword_classify(t, carrier_hint)
    if keyword_result is not None:
        return keyword_result

    proj = gcp_project or os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not proj:
        return "no_answer", None, "Could not classify transcript (no GCP project)."

    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", proj)
    os.environ.setdefault("GOOGLE_CLOUD_LOCATION", vertex_location)
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")

    message = json.dumps({"transcript": transcript, "carrier": carrier_hint})
    try:
        raw = await run_agent_async(build_classifier_agent(), message)
        return _parse_llm_classifier_json(raw)
    except Exception as exc:
        logger.warning("ADK classifier failed (%s), falling back to no_answer", exc)
        return "no_answer", None, "Could not classify transcript."


def classify_transcript(
    transcript: str,
    *,
    carrier_hint: str = "Aetna",
    gcp_project: str | None = None,
    vertex_location: str = "us-central1",
) -> tuple[Status, str | None, str]:
    """
    Sync entrypoint for tests and one-off scripts.

    Do not call from an async FastAPI handler or inside any running event loop — use
    :func:`ac_classify_transcript` instead.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(
            ac_classify_transcript(
                transcript,
                carrier_hint=carrier_hint,
                gcp_project=gcp_project,
                vertex_location=vertex_location,
            )
        )
    raise RuntimeError(
        "classify_transcript() cannot be used inside a running event loop; use await ac_classify_transcript()"
    )
