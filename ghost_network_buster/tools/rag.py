"""Lightweight RAG over bundled regulatory snippets (no Vertex Vector Search required).

Swap to Vertex AI Vector Search later by replacing retrieve() implementation.
"""

from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any, TypedDict


class RagChunk(TypedDict):
    source: str
    text: str
    meta: dict[str, Any]


class RagHit(TypedDict, total=False):
    source: str
    excerpt: str
    score: float
    doc_type: str
    jurisdiction: str
    retrieval_boost: float


_CORPUS_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "regulatory_corpus"
_chunks: list[RagChunk] | None = None


def _parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    if not raw.startswith("---\n"):
        return {}, raw
    end = raw.find("\n---\n", 4)
    if end == -1:
        return {}, raw
    meta: dict[str, Any] = {}
    for line in raw[4:end].splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k == "retrieval_boost":
            try:
                meta[k] = float(v)
            except ValueError:
                meta[k] = 1.0
        else:
            meta[k] = v
    return meta, raw[end + 5 :].strip()


def _tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) > 2]


def _load_chunks() -> list[RagChunk]:
    global _chunks  # noqa: PLW0603
    if _chunks is not None:
        return _chunks
    out: list[RagChunk] = []
    if not _CORPUS_ROOT.exists():
        _chunks = []
        return _chunks
    for path in sorted(_CORPUS_ROOT.rglob("*.md")):
        raw = path.read_text(encoding="utf-8")
        meta, body = _parse_frontmatter(raw)
        rel = str(path.relative_to(_CORPUS_ROOT))
        if meta:
            label = str(
                meta.get("statute")
                or meta.get("display_name")
                or meta.get("source_url")
                or path.stem
            )
            out.append(
                RagChunk(
                    source=f"{rel}:{label[:56]}",
                    text=body[:8000],
                    meta=dict(meta),
                )
            )
            continue
        # Legacy markdown: split on level-2 headings when present
        parts = re.split(r"\n##\s+", body)
        for i, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
            title = path.stem if i == 0 else part.split("\n", 1)[0].strip()
            body_i = part if i == 0 else part.split("\n", 1)[-1].strip()
            out.append(
                RagChunk(
                    source=f"{rel}:{title[:48]}",
                    text=body_i[:4000],
                    meta={},
                )
            )
    _chunks = out
    return _chunks


def retrieve(query: str, *, top_k: int = 4) -> list[RagHit]:
    """TF-IDF cosine over token bags (small corpus; fine for capstone)."""
    chunks = _load_chunks()
    if not chunks or not query.strip():
        return []
    q_terms = _tokenize(query)
    if not q_terms:
        return []
    q_tf: dict[str, float] = {}
    for t in q_terms:
        q_tf[t] = q_tf.get(t, 0) + 1
    n_docs = len(chunks)
    df: dict[str, int] = {}
    doc_vecs: list[dict[str, float]] = []
    for ch in chunks:
        terms = _tokenize(ch["text"])
        tf: dict[str, float] = {}
        seen = set()
        for t in terms:
            tf[t] = tf.get(t, 0) + 1
            if t not in seen:
                df[t] = df.get(t, 0) + 1
                seen.add(t)
        doc_vecs.append(tf)

    def idf(t: str) -> float:
        return math.log((1 + n_docs) / (1 + df.get(t, 0))) + 1

    q_vec = {t: (c / len(q_terms)) * idf(t) for t, c in q_tf.items()}

    hits: list[RagHit] = []
    for ch, tf in zip(chunks, doc_vecs, strict=True):
        dot = 0.0
        nq = 0.0
        nd = 0.0
        for t, wq in q_vec.items():
            nq += wq * wq
            if t not in tf:
                continue
            wd = (tf[t] / max(len(tf), 1)) * idf(t)
            dot += wq * wd
        for t, w in tf.items():
            wd = (w / max(len(tf), 1)) * idf(t)
            nd += wd * wd
        denom = math.sqrt(nq) * math.sqrt(nd) or 1.0
        base = dot / denom
        m = ch["meta"]
        file_boost = float(m.get("retrieval_boost", 1.0))
        type_boost = 1.12 if m.get("doc_type") == "enforcement_action" else 1.0
        score = base * file_boost * type_boost
        excerpt = ch["text"][:420].replace("\n", " ")
        hit: RagHit = RagHit(
            source=ch["source"],
            excerpt=excerpt,
            score=score,
            retrieval_boost=file_boost,
        )
        if m.get("doc_type"):
            hit["doc_type"] = str(m["doc_type"])
        if m.get("jurisdiction"):
            hit["jurisdiction"] = str(m["jurisdiction"])
        hits.append(hit)
    hits.sort(key=lambda h: h["score"], reverse=True)
    return hits[:top_k]


def rag_context_for_complaint(carrier: str, zip_code: str, ghost_rate: float) -> str:
    q = (
        f"mental health network directory accuracy inadequate ghost providers "
        f"insurance {carrier} zip {zip_code} ghost rate {ghost_rate:.0%} "
        f"MHPAEA parity NSA surprise billing directory verification "
        f"NY Insurance Law section 3217-a 4324 network adequacy DFS complaint"
    )
    hits = retrieve(q, top_k=4)
    lines = []
    for h in hits:
        lines.append(f"[{h['source']}] (score {h['score']:.2f}) {h['excerpt']}")
    return "\n".join(lines)
