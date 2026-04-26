"""
Stream-parse Transparency in Coverage (TiC) in-network JSON with ijson.

Designed for multi-GB files: two-pass when root-level provider_references exists.
Also collects NPIs embedded under negotiated_rates.provider_groups without a root map.
"""

from __future__ import annotations

import gzip
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Any, BinaryIO, Iterator

import ijson

from ghost_network_buster.data_ingestion.mh_cpt import MH_CPT_CODES, MH_HCPCS_CODES, normalize_code

logger = logging.getLogger(__name__)


@contextmanager
def _open_tic_binary(path: Path) -> Iterator[BinaryIO]:
    """Open TiC JSON plain or .gz without fully decompressing to disk."""
    if path.suffix.lower() == ".gz":
        with gzip.open(path, "rb") as f:
            yield f
    else:
        with path.open("rb") as f:
            yield f


def _add_npis_from_obj(obj: Any, sink: set[str]) -> None:
    if isinstance(obj, dict):
        npis = obj.get("npi")
        if isinstance(npis, list):
            for n in npis:
                if n is not None and str(n).strip():
                    sink.add(str(n).strip())
        for v in obj.values():
            _add_npis_from_obj(v, sink)
    elif isinstance(obj, list):
        for v in obj:
            _add_npis_from_obj(v, sink)


def _billing_matches(code: str | None, btype: str | None) -> bool:
    bt = (btype or "").upper().strip()
    nc = normalize_code(code)
    if not nc:
        return False
    if bt == "CPT":
        return nc in MH_CPT_CODES
    if bt in ("HCPCS", "HCPCS LEVEL II", "HCPCS LEVEL II CODES"):
        return nc in MH_HCPCS_CODES
    return False


def _resolve_provider_refs(
    refs: list[Any],
    id_map: dict[int, list[str]],
) -> set[str]:
    out: set[str] = set()
    for pref in refs:
        if isinstance(pref, int):
            out.update(id_map.get(pref, ()))
        elif isinstance(pref, dict):
            _add_npis_from_obj(pref, out)
    return out


def build_provider_reference_map(path: Path) -> dict[int, list[str]]:
    """
    Map provider_group_id (and enumerate index) -> NPI list.
    Returns empty dict if key missing or parse fails.
    """
    id_map: dict[int, list[str]] = {}
    try:
        with _open_tic_binary(path) as f:
            idx = 0
            for item in ijson.items(f, "provider_references.item"):
                if not isinstance(item, dict):
                    idx += 1
                    continue
                npis = [str(n).strip() for n in (item.get("npi") or []) if n is not None]
                gid = item.get("provider_group_id")
                if isinstance(gid, int):
                    id_map[gid] = npis
                id_map[idx] = npis
                idx += 1
    except Exception as e:  # noqa: BLE001
        logger.info("No usable provider_references map (%s); using embedded NPIs only.", e)
        return {}
    return id_map


def extract_bh_npis_from_tic(path: Path) -> set[str]:
    """
    Collect NPIs that appear under mental-health CPT/HCPCS rows in an in-network file.
    """
    id_map = build_provider_reference_map(path)
    npis: set[str] = set()
    with _open_tic_binary(path) as f:
        for item in ijson.items(f, "in_network.item"):
            if not isinstance(item, dict):
                continue
            if not _billing_matches(item.get("billing_code"), item.get("billing_code_type")):
                continue
            for nr in item.get("negotiated_rates") or []:
                if not isinstance(nr, dict):
                    continue
                pref = nr.get("provider_references")
                if isinstance(pref, list) and id_map:
                    npis |= _resolve_provider_refs(pref, id_map)
                for pg in nr.get("provider_groups") or []:
                    _add_npis_from_obj(pg, npis)
                _add_npis_from_obj(nr.get("providers") or [], npis)
    return npis
