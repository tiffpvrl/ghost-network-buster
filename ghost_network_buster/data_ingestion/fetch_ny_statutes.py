"""
Download NY Insurance Law (ISC) sections from Open Legislation API and write markdown chunks.

API: https://legislation.nysenate.gov/ (lawId ISC = Insurance Law)

Requires env: LEGISLATION_NY_SENATE_API_KEY

Usage:
  LEGISLATION_NY_SENATE_API_KEY=... python -m ghost_network_buster.data_ingestion.fetch_ny_statutes
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


def _fetch_section(law_id: str, location_id: str, api_key: str) -> dict:
    url = f"https://legislation.nysenate.gov/api/3/laws/{law_id}/{location_id}?key={api_key}"
    with urllib.request.urlopen(url, timeout=120) as resp:
        return json.load(resp)


def _split_statute_chunks(text: str, *, max_chars: int = 2800) -> list[str]:
    """Split on lettered paragraphs (a) (b) ... when possible; else hard-split."""
    t = text.replace("\\n", "\n").strip()
    parts = re.split(r"\n(?=\s+\([a-z]\)\s)", t)
    if len(parts) <= 1:
        parts = re.split(r"\n(?=\s+\(\d+\)\s)", t)
    chunks: list[str] = []
    buf = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 1 <= max_chars:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            buf = p
    if buf:
        chunks.append(buf)
    return chunks or [t[:max_chars]]


def _write_chunk_files(
    *,
    out_dir: Path,
    law_id: str,
    location_id: str,
    title: str,
    text: str,
    active_date: str,
    doc_type: str,
    retrieval_boost: float,
) -> None:
    source_url = f"https://legislation.nysenate.gov/laws/{law_id}/{location_id}"
    chunks = _split_statute_chunks(text)
    for i, body in enumerate(chunks):
        fn = f"ny_{law_id.lower()}_{location_id.replace('-', '_').lower()}__chunk{i+1:02d}.md"
        path = out_dir / fn
        fm = "\n".join(
            [
                "---",
                f'source_url: "{source_url}"',
                f'doc_type: "{doc_type}"',
                'jurisdiction: "ny_state"',
                f'statute: "NY Insurance Law §{location_id}"',
                f'section_title: "{title.replace(chr(34), chr(39))}"',
                f'active_date: "{active_date}"',
                f"retrieval_boost: {retrieval_boost}",
                "---",
                "",
            ]
        )
        path.write_text(fm + body + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "data" / "regulatory_corpus",
    )
    args = parser.parse_args()
    key = os.environ.get("LEGISLATION_NY_SENATE_API_KEY", "").strip()
    if not key:
        print("Set LEGISLATION_NY_SENATE_API_KEY", file=sys.stderr)
        return 1
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for loc, boost in (("3217-A", 1.15), ("4324", 1.15)):
        try:
            data = _fetch_section("ISC", loc, key)
        except urllib.error.HTTPError as e:
            print(f"HTTP error {loc}: {e}", file=sys.stderr)
            return 1
        if not data.get("success"):
            print(f"API error {loc}: {data.get('message')}", file=sys.stderr)
            return 1
        r = data["result"]
        _write_chunk_files(
            out_dir=args.output_dir,
            law_id="ISC",
            location_id=loc,
            title=r.get("title") or "",
            text=r.get("text") or "",
            active_date=str(r.get("activeDate") or ""),
            doc_type="statute",
            retrieval_boost=boost,
        )
        print(f"Wrote chunks for ISC §{loc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
