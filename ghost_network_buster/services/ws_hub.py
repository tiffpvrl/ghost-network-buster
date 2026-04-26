"""Fan-out audit summary JSON to WebSocket subscribers."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket

from ghost_network_buster.models import AuditSummary


class WsHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, audit_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(audit_id, set()).add(ws)

    async def disconnect(self, audit_id: str, ws: WebSocket) -> None:
        async with self._lock:
            if audit_id in self._rooms:
                self._rooms[audit_id].discard(ws)
                if not self._rooms[audit_id]:
                    del self._rooms[audit_id]

    async def broadcast(self, audit_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._rooms.get(audit_id, ()))
        if not clients:
            return
        text = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(text)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            await self.disconnect(audit_id, ws)

    async def broadcast_summary(self, audit_id: str, summary: AuditSummary) -> None:
        await self.broadcast(audit_id, {"type": "summary", "data": summary.model_dump(mode="json")})
