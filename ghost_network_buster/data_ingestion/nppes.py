"""Fetch behavioral-health providers from the CMS NPPES NPI Registry API (v2.1)."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from ghost_network_buster.data_ingestion.bh_taxonomy import is_behavioral_health_taxonomy

logger = logging.getLogger(__name__)

NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/"


@dataclass
class NppesProviderRecord:
    npi: str
    name: str
    phone: str
    postal_code: str | None
    city: str | None
    state: str | None
    address_line1: str | None
    taxonomy_codes: list[str] = field(default_factory=list)
    taxonomy_primary_desc: str | None = None
    enumeration_type: str | None = None


def _location_phone(entry: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """Prefer LOCATION address; fall back to PRIMARY then first with a phone."""
    addresses = entry.get("addresses") or []
    loc = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), None)
    if loc and loc.get("telephone_number"):
        return loc, loc.get("telephone_number")
    prim = next((a for a in addresses if a.get("address_purpose") == "PRIMARY"), None)
    if prim and prim.get("telephone_number"):
        return prim, prim.get("telephone_number")
    for a in addresses:
        if a.get("telephone_number"):
            return a, a.get("telephone_number")
    return loc or (addresses[0] if addresses else None), None


def _display_name(entry: dict[str, Any]) -> str:
    basic = entry.get("basic") or {}
    if entry.get("enumeration_type") == "NPI-1":
        parts = [
            basic.get("first_name", ""),
            basic.get("middle_name", "") or "",
            basic.get("last_name", ""),
            basic.get("credential", "") or "",
        ]
        return " ".join(p for p in parts if p).strip() or (entry.get("number") or "unknown")
    return (basic.get("organization_name") or entry.get("number") or "unknown").strip()


def _parse_entry(entry: dict[str, Any]) -> NppesProviderRecord | None:
    taxonomies = entry.get("taxonomies") or []
    codes = [t.get("code") for t in taxonomies if t.get("code")]
    if not any(is_behavioral_health_taxonomy(c) for c in codes):
        return None
    primary = next((t for t in taxonomies if t.get("primary")), taxonomies[0] if taxonomies else {})
    addr, phone = _location_phone(entry)
    if not phone:
        return None
    npi = str(entry.get("number", "")).strip()
    if len(npi) != 10 or not npi.isdigit():
        return None
    return NppesProviderRecord(
        npi=npi,
        name=_display_name(entry),
        phone=str(phone).strip(),
        postal_code=(addr or {}).get("postal_code"),
        city=(addr or {}).get("city"),
        state=(addr or {}).get("state"),
        address_line1=(addr or {}).get("address_1"),
        taxonomy_codes=[c for c in codes if c],
        taxonomy_primary_desc=primary.get("desc") if isinstance(primary, dict) else None,
        enumeration_type=entry.get("enumeration_type"),
    )


def fetch_nppes_zip_page(
    *,
    state: str,
    postal_code: str,
    skip: int = 0,
    limit: int = 200,
    timeout: float = 60.0,
) -> dict[str, Any]:
    params: dict[str, str | int] = {
        "version": "2.1",
        "state": state,
        "postal_code": postal_code[:5],
        "limit": min(max(limit, 1), 200),
        "skip": skip,
    }
    with httpx.Client(timeout=timeout) as client:
        r = client.get(NPPES_BASE, params=params)
        r.raise_for_status()
        return r.json()


def collect_bh_providers_for_zips(
    zips: list[str],
    *,
    state: str = "NY",
    sleep_s: float = 0.35,
    max_pages_per_zip: int = 50,
) -> dict[str, NppesProviderRecord]:
    """
    Deduplicate by NPI across all ZIPs. Respect API pagination (200 rows max).
    """
    by_npi: dict[str, NppesProviderRecord] = {}
    for z in zips:
        z5 = z.strip()[:5]
        if len(z5) != 5 or not z5.isdigit():
            logger.warning("Skip invalid zip %r", z)
            continue
        skip = 0
        pages = 0
        while pages < max_pages_per_zip:
            data = fetch_nppes_zip_page(state=state, postal_code=z5, skip=skip)
            results = data.get("results") or []
            for entry in results:
                rec = _parse_entry(entry)
                if rec:
                    by_npi[rec.npi] = rec
            result_count = int(data.get("result_count") or 0)
            skip += len(results)
            pages += 1
            if skip >= result_count or len(results) == 0:
                break
            time.sleep(sleep_s)
        time.sleep(sleep_s)
    return by_npi
