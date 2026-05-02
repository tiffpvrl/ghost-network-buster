"""
Classifier eval suite — runs all 20 scenarios in evals/call_scenarios.json.

Keyword-path scenarios (S01, S02, S16, S17) run with no GCP dependency.
LLM-path scenarios are skipped automatically when GOOGLE_CLOUD_PROJECT is
not set (avoids failures in CI / offline environments).

Run all:
    pytest tests/test_classifier_eval.py -v

Run keyword-only (no GCP):
    pytest tests/test_classifier_eval.py -v -k "keyword"
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

# Load .env so tests work without manually exporting env vars in the shell
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

from ghost_network_buster.agents.classifier import classify_transcript

_GCP_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT")


def _scenarios() -> list[dict]:
    path = Path(__file__).resolve().parent.parent / "evals" / "call_scenarios.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    # Support both old flat list and new versioned dict format
    return data["scenarios"] if isinstance(data, dict) else data


def _scenario_id(s: dict) -> str:
    return s.get("id", "unknown")


@pytest.mark.parametrize("scenario", _scenarios(), ids=_scenario_id)
def test_classifier_matches_expected(scenario: dict) -> None:
    classifier_path = scenario.get("classifier_path", "llm")

    # Skip LLM-path scenarios when GCP is not configured
    if classifier_path == "llm" and not _GCP_PROJECT:
        pytest.skip("GOOGLE_CLOUD_PROJECT not set — skipping LLM-path scenario")

    expected = scenario["expected"]
    expected_status = expected["status"]
    expected_ghost_reason = expected.get("ghost_reason")
    carrier = scenario.get("carrier", "Aetna")

    status, ghost_reason, _ = classify_transcript(
        scenario["transcript"],
        carrier_hint=carrier,
        gcp_project=_GCP_PROJECT,
    )

    assert status == expected_status, (
        f"[{scenario['id']}] status mismatch: got {status!r}, expected {expected_status!r}\n"
        f"  carrier={carrier!r}\n"
        f"  transcript={scenario['transcript'][:120]!r}"
    )

    if expected_ghost_reason is not None:
        assert ghost_reason == expected_ghost_reason, (
            f"[{scenario['id']}] ghost_reason mismatch: got {ghost_reason!r}, expected {expected_ghost_reason!r}"
        )
