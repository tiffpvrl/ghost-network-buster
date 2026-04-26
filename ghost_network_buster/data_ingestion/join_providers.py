"""
Build `Provider` JSON for the app: NPPES (behavioral health, by ZIP) ∩ TiC NPIs (MH codes).

Usage:
  python -m ghost_network_buster.data_ingestion.join_providers \\
    --zips-file data/nyc_zips_core.json --max-zips 8 \\
    --tic-file ~/Downloads/aetna_in_network.json \\
    --output data/providers_aetna_nyc.json

  # NPPES only (no Aetna network filter):
  python -m ghost_network_buster.data_ingestion.join_providers --nppes-only --max-zips 5
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from ghost_network_buster.data_ingestion.nppes import NppesProviderRecord, collect_bh_providers_for_zips
from ghost_network_buster.data_ingestion.tic_parse import extract_bh_npis_from_tic
from ghost_network_buster.models import Provider

logger = logging.getLogger(__name__)


def _normalize_us_phone(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) >= 10:
        return f"+1{digits[-10:]}"
    return raw.strip()


def _to_provider(rec: NppesProviderRecord, *, source: str) -> Provider:
    spec = rec.taxonomy_primary_desc or (
        ", ".join(rec.taxonomy_codes[:3]) if rec.taxonomy_codes else None
    )
    return Provider(
        npi=rec.npi,
        name=rec.name[:200],
        phone=_normalize_us_phone(rec.phone),
        specialty=spec,
        mock_outcome=None,
    )


def run_join(
    *,
    zips: list[str],
    tic_path: Path | None,
    nppes_only: bool,
    max_per_zip_pages: int,
    sleep_s: float,
) -> tuple[list[Provider], dict]:
    meta: dict = {"zips": zips, "tic_file": str(tic_path) if tic_path else None}
    nppes_map = collect_bh_providers_for_zips(
        zips, sleep_s=sleep_s, max_pages_per_zip=max_per_zip_pages
    )
    meta["nppes_bh_providers"] = len(nppes_map)

    if nppes_only or not tic_path:
        providers = [
            _to_provider(rec, source="nppes_only")
            for rec in sorted(nppes_map.values(), key=lambda r: r.npi)
        ]
        meta["join_mode"] = "nppes_only"
        meta["output_count"] = len(providers)
        return providers, meta

    tic_npis = extract_bh_npis_from_tic(tic_path)
    meta["tic_bh_npis"] = len(tic_npis)
    joined = sorted(nppes_map.keys() & tic_npis)
    meta["joined_count"] = len(joined)
    providers = [_to_provider(nppes_map[npi], source="nppes_x_tic") for npi in joined]
    meta["join_mode"] = "nppes_intersect_tic"
    meta["output_count"] = len(providers)
    return providers, meta


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    repo = Path(__file__).resolve().parent.parent.parent
    parser = argparse.ArgumentParser(description="Build provider list from NPPES + TiC MRF")
    parser.add_argument(
        "--zips-file",
        type=Path,
        default=repo / "data" / "nyc_zips_core.json",
        help="JSON array of 5-digit ZIP strings",
    )
    parser.add_argument("--max-zips", type=int, default=0, help="0 = use all zips in file (many API calls)")
    parser.add_argument("--nppes-only", action="store_true", help="Skip TiC; export all BH NPPES rows in ZIPs")
    parser.add_argument("--tic-file", type=Path, default=None, help="Path to one Aetna in-network JSON MRF")
    parser.add_argument(
        "--output",
        type=Path,
        default=repo / "data" / "providers_aetna_nyc_joined.json",
    )
    parser.add_argument("--meta-output", type=Path, default=None, help="Write build metadata JSON")
    parser.add_argument("--max-pages-per-zip", type=int, default=25, help="Pagination cap per ZIP")
    parser.add_argument("--sleep", type=float, default=0.35, help="Delay between NPPES calls (seconds)")
    args = parser.parse_args(argv)

    zips_raw = json.loads(args.zips_file.read_text(encoding="utf-8"))
    if not isinstance(zips_raw, list):
        logger.error("zips-file must be a JSON array")
        return 1
    zips = [str(z) for z in zips_raw]
    if args.max_zips and args.max_zips > 0:
        zips = zips[: args.max_zips]

    if not args.nppes_only and not args.tic_file:
        logger.error("Provide --tic-file or pass --nppes-only")
        return 1
    if args.tic_file and not args.nppes_only and not args.tic_file.is_file():
        logger.error("TiC file not found: %s", args.tic_file)
        return 1

    providers, meta = run_join(
        zips=zips,
        tic_path=args.tic_file,
        nppes_only=args.nppes_only,
        max_per_zip_pages=args.max_pages_per_zip,
        sleep_s=args.sleep,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps([p.model_dump(mode="json") for p in providers], indent=2),
        encoding="utf-8",
    )
    logger.info("Wrote %s providers -> %s", len(providers), args.output)

    meta_path = args.meta_output or args.output.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info("Wrote metadata -> %s", meta_path)

    if len(providers) == 0:
        logger.warning(
            "Zero providers after join. Check TiC file matches plan geography, "
            "or widen ZIP list / use --nppes-only to validate NPPES path."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
