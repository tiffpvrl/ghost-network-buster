"""
Export all regulatory_corpus markdown chunks to JSONL for Vertex AI Vector Search ingestion.

Each line: {"id", "text", "structData": {...}} — embeddings added by Vertex on import.

Usage:
  python -m ghost_network_buster.data_ingestion.export_vertex_jsonl \\
    --output data/regulatory_corpus/vertex_chunks.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def _parse_frontmatter(raw: str) -> tuple[dict[str, object], str]:
    if not raw.startswith("---\n"):
        return {}, raw
    end = raw.find("\n---\n", 4)
    if end == -1:
        return {}, raw
    fm_lines = raw[4:end].splitlines()
    body = raw[end + 5 :]
    meta: dict[str, object] = {}
    for line in fm_lines:
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
    return meta, body


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--corpus-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "data" / "regulatory_corpus",
    )
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    paths = sorted(args.corpus_root.rglob("*.md"))
    if not paths:
        print("No markdown under", args.corpus_root, file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with args.output.open("w", encoding="utf-8") as out:
        for path in paths:
            raw = path.read_text(encoding="utf-8")
            meta, body = _parse_frontmatter(raw)
            body = body.strip()
            if not body:
                continue
            rel = str(path.relative_to(args.corpus_root))
            doc_id = hashlib.sha256(rel.encode()).hexdigest()[:24]
            struct = {
                "source_path": rel,
                **{k: v for k, v in meta.items() if k != "retrieval_boost"},
                "retrieval_boost": float(meta.get("retrieval_boost", 1.0)),
            }
            rec = {"id": doc_id, "text": body[:8000], "structData": struct}
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
    print(f"Wrote {n} records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
