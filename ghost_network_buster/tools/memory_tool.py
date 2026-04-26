"""Per-NPI call history (local dir or GCS) — retention / moat story for README."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from ghost_network_buster.models import CallResult

if TYPE_CHECKING:
    from ghost_network_buster.config import Settings

logger = logging.getLogger(__name__)


def _memory_path(settings: Settings, npi: str) -> Path | None:
    if not settings.memory_local_dir:
        return None
    base = Path(settings.memory_local_dir)
    if not base.is_absolute():
        base = Path(__file__).resolve().parent.parent.parent / base
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{npi}.json"


async def record_call(settings: Settings, result: CallResult) -> None:
    """Append last verification snapshot for an NPI."""
    payload = {
        "npi": result.npi,
        "last_status": result.status,
        "last_summary": result.summary,
        "verified_at": result.verified_at,
        "transcript_excerpt": (result.transcript or "")[:2000],
    }
    raw = json.dumps(payload, indent=2)

    if settings.gcs_memory_bucket:
        try:
            from google.cloud import storage  # type: ignore import-not-found

            def _upload() -> None:
                client = storage.Client(project=settings.google_cloud_project)
                bucket = client.bucket(settings.gcs_memory_bucket)
                blob = bucket.blob(f"{settings.gcs_memory_prefix}{result.npi}.json")
                blob.upload_from_string(raw, content_type="application/json")

            await asyncio.to_thread(_upload)
            return
        except Exception as e:  # noqa: BLE001
            logger.warning("GCS memory write failed: %s", e)

    path = _memory_path(settings, result.npi)
    if path:
        await asyncio.to_thread(path.write_text, raw, encoding="utf-8")
