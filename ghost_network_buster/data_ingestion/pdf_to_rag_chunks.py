"""
Extract text from sources/*.pdf and emit markdown chunks under data/regulatory_corpus/from_pdf/

Uses sources/manifest.json for doc_type, jurisdiction, retrieval_boost.

Requires: pip install pypdf

Usage:
  python -m ghost_network_buster.data_ingestion.pdf_to_rag_chunks
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore[misc, assignment]


def _split_chunks(text: str, *, max_chars: int = 2400) -> list[str]:
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []
    # Prefer numbered section / article breaks common in legal PDFs
    parts = re.split(r"\n(?=\s*(?:Section|SECTION|Article|ARTICLE)\s+\d)", text)
    if len(parts) < 2:
        parts = re.split(r"\n(?=\d+\.\s+[A-Z])", text)
    chunks: list[str] = []
    buf = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            if len(p) <= max_chars:
                buf = p
            else:
                for i in range(0, len(p), max_chars):
                    chunks.append(p[i : i + max_chars])
                buf = ""
    if buf:
        chunks.append(buf)
    return chunks


def main() -> int:
    if PdfReader is None:
        print("Install pypdf: pip install pypdf", file=sys.stderr)
        return 1
    repo = Path(__file__).resolve().parent.parent.parent
    sources = repo / "sources"
    manifest_path = sources / "manifest.json"
    out_dir = repo / "data" / "regulatory_corpus" / "from_pdf"
    if not manifest_path.is_file():
        print("Missing sources/manifest.json", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, meta in manifest.items():
        pdf_path = sources / filename
        if not pdf_path.is_file():
            print("Skip missing file:", filename, file=sys.stderr)
            continue
        reader = PdfReader(str(pdf_path))
        pages_text: list[str] = []
        for page in reader.pages:
            try:
                t = page.extract_text() or ""
            except Exception:  # noqa: BLE001
                t = ""
            pages_text.append(t)
        full = "\n\n".join(pages_text)
        chunks = _split_chunks(full)
        stem = re.sub(r"[^a-z0-9]+", "_", filename.lower())[:60].strip("_")
        boost = float(meta.get("retrieval_boost", 1.0))
        for i, body in enumerate(chunks):
            fn = f"{stem}__chunk{i+1:03d}.md"
            path = out_dir / fn
            title = meta.get("display_name", filename)
            fm = "\n".join(
                [
                    "---",
                    f'source_file: "{filename}"',
                    f'display_name: "{title.replace(chr(34), chr(39))}"',
                    f'doc_type: "{meta.get("doc_type", "unknown")}"',
                    f'jurisdiction: "{meta.get("jurisdiction", "unknown")}"',
                    f'document_date: "{meta.get("date", "")}"',
                    f"retrieval_boost: {boost}",
                    "---",
                    "",
                ]
            )
            path.write_text(fm + body + "\n", encoding="utf-8")
        print(f"Wrote {len(chunks)} chunks for {filename}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
