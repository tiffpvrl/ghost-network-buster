"""Commit interim STT text as a synthetic final when Deepgram omits finals on short utterances."""

from __future__ import annotations

import asyncio
import logging
import re

from pipecat.frames.frames import (
    CancelFrame,
    EndFrame,
    Frame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

logger = logging.getLogger(__name__)

_NON_WORD = re.compile(r"[^\w\s]+", re.UNICODE)


def _normalize_for_dedupe(text: str) -> str:
    s = text.strip().lower()
    s = _NON_WORD.sub(" ", s)
    return " ".join(s.split())


class SttInterimCommitProcessor(FrameProcessor):
    """After VAD stop, emit a TranscriptionFrame from the last interim if no final arrives in time.

    Deepgram sometimes returns no ``is_final`` transcript for very short phone utterances even after
    ``Finalize``; without a final, downstream LLM never runs. This processor bridges that gap while
    attempting to drop a duplicate final if Deepgram later sends text equivalent to the synthetic one.
    """

    def __init__(
        self,
        *,
        commit_delay_ms: int = 450,
        min_chars: int = 2,
        enabled: bool = True,
        diagnostics_enabled: bool = False,
    ) -> None:
        super().__init__()
        self._commit_delay_ms = max(0, commit_delay_ms)
        self._min_chars = max(1, min_chars)
        self._enabled = enabled
        self._diagnostics_enabled = diagnostics_enabled

        self._latest_interim: str = ""
        self._best_interim: str = ""
        self._last_user_id: str = ""
        self._last_language: Language | None = None
        self._dedupe_norm: str | None = None
        self._pending: asyncio.Task[None] | None = None

    async def _cancel_pending(self) -> None:
        t = self._pending
        self._pending = None
        if t is not None:
            await self.cancel_task(t)

    async def cleanup(self) -> None:
        await self._cancel_pending()
        await super().cleanup()

    async def _emit_commit(self, text: str, user_id: str, language: Language | None) -> None:
        raw = text.strip()
        if len(raw) < self._min_chars:
            return
        self._dedupe_norm = _normalize_for_dedupe(raw)
        logger.info(
            "STT interim→final commit (%d chars, no Deepgram final in %d ms): %r",
            len(raw),
            self._commit_delay_ms,
            raw[:240],
        )
        await self.push_frame(
            TranscriptionFrame(
                raw,
                user_id,
                time_now_iso8601(),
                language,
                result=None,
                finalized=False,
            ),
            FrameDirection.DOWNSTREAM,
        )

    async def _delayed_commit(self, captured: str, user_id: str, language: Language | None) -> None:
        try:
            delay_s = self._commit_delay_ms / 1000.0
            if delay_s > 0:
                await asyncio.sleep(delay_s)
            await self._emit_commit(captured, user_id, language)
        except asyncio.CancelledError:
            raise
        finally:
            self._pending = None

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)

        if isinstance(frame, InterimTranscriptionFrame):
            self._latest_interim = frame.text or ""
            cand = self._latest_interim.strip()
            if len(cand) > len(self._best_interim):
                self._best_interim = cand
            self._last_user_id = frame.user_id or ""
            self._last_language = frame.language
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, TranscriptionFrame):
            await self._cancel_pending()
            raw = (frame.text or "").strip()
            if raw and self._dedupe_norm and _normalize_for_dedupe(raw) == self._dedupe_norm:
                logger.info("STT suppressed duplicate final after interim commit: %r", raw[:200])
                self._dedupe_norm = None
                return
            self._dedupe_norm = None
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, VADUserStartedSpeakingFrame):
            await self._cancel_pending()
            self._best_interim = ""
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, VADUserStoppedSpeakingFrame):
            await self.push_frame(frame, direction)
            if self._enabled and self._commit_delay_ms >= 0:
                await self._cancel_pending()
                snap = (self._best_interim or self._latest_interim or "").strip()
                if len(snap) >= self._min_chars:
                    uid = self._last_user_id
                    lang = self._last_language
                    self._pending = self.create_task(
                        self._delayed_commit(snap, uid, lang),
                        name="stt_interim_commit",
                    )
                elif snap:
                    if self._diagnostics_enabled:
                        from loguru import logger as ur  # noqa: PLC0415

                        ur.info(
                            "STT: VAD user stopped but interim too short to commit "
                            "({} chars, need {}): {!r}",
                            len(snap),
                            self._min_chars,
                            snap[:120],
                        )
                    else:
                        logger.debug(
                            "STT: VAD user stopped but interim too short to commit "
                            "(%d chars, need %d): %r",
                            len(snap),
                            self._min_chars,
                            snap[:120],
                        )
                else:
                    if self._diagnostics_enabled:
                        from loguru import logger as ur  # noqa: PLC0415

                        ur.info(
                            "STT: VAD user stopped with no Deepgram interim yet — "
                            "check 8 kHz STT alignment, Deepgram, or VOICE_VAD_STOP_SECS"
                        )
                    else:
                        logger.debug(
                            "STT: VAD user stopped with no Deepgram interim yet "
                            "(check audio/Deepgram or raise VOICE_VAD_STOP_SECS)"
                        )
            return

        if isinstance(frame, (EndFrame, CancelFrame)):
            await self._cancel_pending()

        await self.push_frame(frame, direction)
