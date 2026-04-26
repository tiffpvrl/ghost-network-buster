import json
from pathlib import Path

import pytest

from ghost_network_buster.agents.classifier import classify_transcript


def _scenarios():
    path = Path(__file__).resolve().parent.parent / "evals" / "call_scenarios.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("scenario", _scenarios(), ids=lambda s: s["id"])
def test_classifier_matches_expected(scenario: dict) -> None:
    status, _, _ = classify_transcript(scenario["transcript"], carrier_hint="Aetna")
    assert status == scenario["expected_status"]
