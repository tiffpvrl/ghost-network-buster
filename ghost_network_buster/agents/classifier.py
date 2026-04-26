"""Deterministic transcript classification for evals and offline checks."""

from __future__ import annotations

import re
from typing import Literal

Status = Literal["real", "ghost", "voicemail", "no_answer", "error"]


def classify_transcript(transcript: str, *, carrier_hint: str = "Aetna") -> tuple[Status, str | None, str]:
    """
    Returns (status, ghost_reason, summary).
    Heuristic only — Retell+LLM path uses provider responses; this mirrors mock patterns.
    """
    t = (transcript or "").lower()
    if "voicemail" in t or "[beep]" in t or "leave a message" in t:
        return "voicemail", None, "Voicemail; no human confirmation."
    if "dial tone" in t or "not in service" in t or "disconnected" in t:
        return "ghost", "disconnected", "Line disconnected or not in service."
    if "haven't taken" in t or "out of network" in t or "don't accept" in t:
        return "ghost", "wrong_network", f"Practice reports not in network for {carrier_hint}."
    if re.search(r"\b(yes|we are accepting|taking new patients)\b", t) and "opening" in t:
        return "real", None, "Accepting new patients (heuristic)."
    if re.search(r"\b(yes|we are)\b", t) and "new patient" in t:
        return "real", None, "Likely accepting (heuristic)."
    return "no_answer", None, "Could not classify transcript."
