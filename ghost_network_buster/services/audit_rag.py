"""Shared RAG query for audit summaries and ADK complaint stages."""

from __future__ import annotations

from ghost_network_buster.models import AuditState
from ghost_network_buster.tools.rag import retrieve


def rag_hits_for_audit_state(
    state: AuditState,
    *,
    require_completed: bool = True,
) -> list[dict[str, object]]:
    """
    Retrieve regulatory context chunks for an audit.

    When require_completed is False, allow retrieval while status is still
    ``running`` (used during ADK graph execution before the final mark-complete).
    """
    if require_completed and state.status != "completed":
        return []
    if not require_completed and not state.results:
        return []

    n = len(state.results) or 1
    ghosts = sum(1 for r in state.results if r.status == "ghost")
    gr = ghosts / n
    q = (
        f"mental health network directory accuracy inadequate ghost providers "
        f"insurance {state.carrier} zip {state.zip_code} ghost rate {gr:.0%} "
        f"MHPAEA parity NSA directory verification "
        f"NY Insurance Law 3217-a 4324 network adequacy DFS complaint"
    )
    hits = retrieve(q, top_k=4)
    rows: list[dict[str, object]] = []
    for h in hits:
        row: dict[str, object] = {
            "source": h["source"],
            "excerpt": h["excerpt"],
            "score": round(h["score"], 4),
        }
        if h.get("doc_type"):
            row["doc_type"] = h["doc_type"]
        if h.get("jurisdiction"):
            row["jurisdiction"] = h["jurisdiction"]
        rows.append(row)
    return rows
