from pathlib import Path

import pytest

import ghost_network_buster.tools.rag as rag


def test_parse_frontmatter_roundtrip() -> None:
    md = """---
source_url: "https://example.com/law"
doc_type: "statute"
jurisdiction: "ny_state"
retrieval_boost: 1.5
---

Body line one.
"""
    meta, body = rag._parse_frontmatter(md)
    assert meta["doc_type"] == "statute"
    assert meta["retrieval_boost"] == 1.5
    assert "Body line one" in body


def test_retrieval_boost_prefers_weighted_chunk(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    corpus = tmp_path / "regulatory_corpus"
    corpus.mkdir()
    (corpus / "low.md").write_text(
        "---\ndoc_type: study\nretrieval_boost: 0.5\n---\n"
        "directory accuracy verification behavioral health network adequacy complaint DFS\n",
        encoding="utf-8",
    )
    (corpus / "high.md").write_text(
        "---\ndoc_type: enforcement_action\nretrieval_boost: 2.0\n---\n"
        "directory accuracy verification behavioral health network adequacy complaint DFS\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(rag, "_CORPUS_ROOT", corpus)
    rag._chunks = None
    hits = rag.retrieve("directory accuracy behavioral health network DFS", top_k=2)
    rag._chunks = None
    assert len(hits) == 2
    assert hits[0]["source"].startswith("high.md")
