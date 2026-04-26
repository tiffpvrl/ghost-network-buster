"""Audit persistence: memory cache + optional local disk + optional GCS (Cloud Run friendly)."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from ghost_network_buster.models import AuditState

if TYPE_CHECKING:
    from ghost_network_buster.config import Settings

logger = logging.getLogger(__name__)


class AuditStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache: dict[str, AuditState] = {}
        self._gcs_client = None
        self._bucket = None
        if settings.gcs_audits_bucket:
            try:
                from google.cloud import storage  # type: ignore import-not-found

                self._gcs_client = storage.Client(project=settings.google_cloud_project)
                self._bucket = self._gcs_client.bucket(settings.gcs_audits_bucket)
            except Exception as e:  # noqa: BLE001
                logger.warning("GCS audit persistence disabled: %s", e)
                self._bucket = None

    def _local_path(self, audit_id: str) -> Path | None:
        if not self._settings.audit_local_dir:
            return None
        base = Path(self._settings.audit_local_dir)
        if not base.is_absolute():
            base = Path(__file__).resolve().parent.parent.parent / base
        base.mkdir(parents=True, exist_ok=True)
        return base / f"{audit_id}.json"

    def _write_sync(self, state: AuditState) -> None:
        payload = state.model_dump(mode="json")
        raw = json.dumps(payload, indent=2)
        if self._bucket:
            blob = self._bucket.blob(f"{self._settings.gcs_audits_prefix}{state.audit_id}.json")
            blob.upload_from_string(raw, content_type="application/json")
            return
        path = self._local_path(state.audit_id)
        if path:
            path.write_text(raw, encoding="utf-8")

    def _read_sync(self, audit_id: str) -> AuditState | None:
        if self._bucket:
            blob = self._bucket.blob(f"{self._settings.gcs_audits_prefix}{audit_id}.json")
            if not blob.exists():
                return None
            raw = blob.download_as_text()
            return AuditState.model_validate_json(raw)
        path = self._local_path(audit_id)
        if path and path.exists():
            return AuditState.model_validate_json(path.read_text(encoding="utf-8"))
        return None

    async def save(self, state: AuditState) -> None:
        self._cache[state.audit_id] = state
        await asyncio.to_thread(self._write_sync, state)

    async def load(self, audit_id: str) -> AuditState | None:
        if audit_id in self._cache:
            return self._cache[audit_id]
        state = await asyncio.to_thread(self._read_sync, audit_id)
        if state:
            self._cache[audit_id] = state
        return state

    def cache_put(self, state: AuditState) -> None:
        """In-process only (before async save completes)."""
        self._cache[state.audit_id] = state
