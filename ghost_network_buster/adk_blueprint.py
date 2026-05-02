"""
Google ADK agent tree for Ghost Network Buster (architecture + class rubric).

Live audit execution uses FastAPI + asyncio pipeline; this module defines the
equivalent multi-agent structure using ADK primitives for introspection and
future Runner-based execution when Vertex is fully wired.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.parallel_agent import ParallelAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.events.event import Event
from google.genai import types
from pydantic import Field
from typing_extensions import override


class StageMarkerAgent(BaseAgent):
    """Non-LLM agent that emits a single marker event (documents a pipeline stage)."""

    marker_text: str = Field(default="")

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=self.marker_text or f"{self.name} stage")],
            ),
        )


def build_audit_agent_blueprint() -> BaseAgent:
    """Sequential workflow: directory -> parallel voice slots -> classify -> RAG complaint hook."""
    directory = StageMarkerAgent(
        name="directory_agent",
        description="Load and deduplicate insurer directory rows (JSON / future MRF ingest).",
        marker_text="Directory loaded and deduplicated.",
    )
    fanout = ParallelAgent(
        name="parallel_caller_agent",
        description="Fan out Twilio/Pipecat voice verification calls (bounded concurrency).",
        sub_agents=[
            StageMarkerAgent(
                name="caller_worker_a",
                description="Outbound call worker slot.",
                marker_text="Caller worker ready (actual calls run in FastAPI pipeline).",
            ),
            StageMarkerAgent(
                name="caller_worker_b",
                description="Outbound call worker slot.",
                marker_text="Caller worker ready (actual calls run in FastAPI pipeline).",
            ),
        ],
    )
    classifier = StageMarkerAgent(
        name="classifier_agent",
        description="Map transcript + telephony outcome to CallResult (Pydantic).",
        marker_text="Classification: ghost vs real vs voicemail.",
    )
    rag = StageMarkerAgent(
        name="complaint_rag_agent",
        description="Retrieve statutory / regulatory snippets for complaint drafts (local TF-IDF or Vertex).",
        marker_text="RAG retrieve for network adequacy / parity hooks.",
    )
    synthesizer = StageMarkerAgent(
        name="synthesizer_agent",
        description="Build AuditSummary, PDFs, employer aggregates.",
        marker_text="Synthesize audit report + downloads.",
    )
    return SequentialAgent(
        name="ghost_network_buster_root",
        description="Root orchestrator for directory accuracy audits.",
        sub_agents=[directory, fanout, classifier, rag, synthesizer],
    )


def agent_tree_to_dict(agent: BaseAgent) -> dict[str, Any]:
    return {
        "name": agent.name,
        "type": type(agent).__name__,
        "description": agent.description,
        "sub_agents": [agent_tree_to_dict(child) for child in agent.sub_agents],
    }
