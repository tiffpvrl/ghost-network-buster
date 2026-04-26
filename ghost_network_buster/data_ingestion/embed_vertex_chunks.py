"""
Embed lines from export_vertex_jsonl output → JSONL for Vertex AI Vector Search.

Input lines: {"id", "text", "structData": ...}
Output lines: {"id", "embedding": [float, ...]}

Requires: pip install google-cloud-aiplatform
Auth: application default credentials (gcloud auth application-default login, or Cloud Shell).

Usage (from repo root):
  export GOOGLE_CLOUD_PROJECT=your-project
  export VERTEX_LOCATION=us-central1
  python -m ghost_network_buster.data_ingestion.embed_vertex_chunks \\
    --input data/regulatory_corpus/vertex_chunks.jsonl \\
    --output data/regulatory_corpus/vector_index.jsonl

Cloud Shell with input in GCS:
  python -m ghost_network_buster.data_ingestion.embed_vertex_chunks \\
    --input gs://BUCKET/rag/vertex_chunks.jsonl \\
    --output /tmp/vector_index.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterator
from pathlib import Path


def _iter_jsonl_lines(path: str, *, project: str | None) -> Iterator[str]:
    if path.startswith("gs://"):
        from google.cloud import storage

        rest = path[5:]
        bucket_name, _, blob_path = rest.partition("/")
        client = storage.Client(project=project)
        data = client.bucket(bucket_name).blob(blob_path).download_as_bytes().decode("utf-8")
        for line in data.splitlines():
            if line.strip():
                yield line
    else:
        p = Path(path)
        with p.open(encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    yield line


def main() -> int:
    repo = Path(__file__).resolve().parent.parent.parent
    ap = argparse.ArgumentParser(description="Embed vertex_chunks.jsonl for Vector Search")
    ap.add_argument(
        "--input",
        type=str,
        default=str(repo / "data" / "regulatory_corpus" / "vertex_chunks.jsonl"),
        help="Local path or gs://... to vertex_chunks.jsonl",
    )
    ap.add_argument(
        "--output",
        type=str,
        default=str(repo / "data" / "regulatory_corpus" / "vector_index.jsonl"),
        help="Local path to write embedding JSONL (upload this folder to GCS for index build)",
    )
    ap.add_argument("--project", type=str, default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    ap.add_argument(
        "--location",
        type=str,
        default=os.environ.get("VERTEX_LOCATION", os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")),
    )
    ap.add_argument("--model", type=str, default="text-embedding-004")
    ap.add_argument("--batch-size", type=int, default=5, help="Embedding API batch size")
    args = ap.parse_args()
    if not args.project:
        print("Set --project or GOOGLE_CLOUD_PROJECT", file=sys.stderr)
        return 1

    try:
        import vertexai
        from vertexai.language_models import TextEmbeddingModel
    except ImportError:
        print("Install: pip install google-cloud-aiplatform", file=sys.stderr)
        return 1

    vertexai.init(project=args.project, location=args.location)
    model = TextEmbeddingModel.from_pretrained(args.model)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    batch: list[tuple[str, str]] = []
    n_out = 0

    def flush() -> None:
        nonlocal n_out, batch
        if not batch:
            return
        texts = [t for _, t in batch]
        ids = [i for i, _ in batch]
        embs = model.get_embeddings(texts)
        with out_path.open("a", encoding="utf-8") as fout:
            for doc_id, emb in zip(ids, embs, strict=True):
                fout.write(json.dumps({"id": doc_id, "embedding": list(emb.values)}) + "\n")
                n_out += 1
        batch = []

    if out_path.exists():
        out_path.unlink()

    for line in _iter_jsonl_lines(args.input, project=args.project or None):
        rec = json.loads(line)
        doc_id = str(rec["id"])
        text = str(rec.get("text", ""))[:7500]
        batch.append((doc_id, text))
        if len(batch) >= args.batch_size:
            flush()
    flush()

    print(f"Wrote {n_out} vectors -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
