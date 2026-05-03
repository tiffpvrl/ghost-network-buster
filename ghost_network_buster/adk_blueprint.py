"""
Google ADK helpers for Ghost Network Buster.

- build_classifier_agent / build_complaint_rag_agent / build_synthesizer_agent:
  LlmAgent nodes used by the classifier module and the ADK audit graph.
- build_audit_agent_blueprint(): static agent tree for GET /api/agents/graph (uses an
  introspection-only execution context; run production audits via run_audit_with_adk).
- run_agent_async(): single-message Runner helper (Vertex from process env / lifespan).
"""

from __future__ import annotations

from typing import Any

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.llm_agent import LlmAgent
from google.genai import types


# ---------------------------------------------------------------------------
# LlmAgent instructions
# ---------------------------------------------------------------------------

_CLASSIFIER_INSTRUCTION = """\
You are an expert at analyzing phone call transcripts between an AI auditor \
and a medical practice receptionist.

The auditor is verifying whether the practice accepts the listed insurance \
carrier for behavioral health services and is accepting new patients.

You will receive a JSON object with:
- "transcript": the full call transcript
- "carrier": the insurance carrier name

Classify the outcome using EXACTLY one of these statuses:
- "real"      — practice confirmed they accept the carrier for behavioral \
health and are taking new patients
- "ghost"     — practice is listed in the directory but is effectively \
inaccessible (see ghost_reason)
- "voicemail" — reached voicemail or answering machine; no human confirmed \
anything
- "no_answer" — call unanswered, or transcript too short/unclear to determine \
outcome

If status is "ghost", set ghost_reason to EXACTLY one of — read the \
definitions carefully before choosing:

  "disconnected"           — the phone number is not in service, the line is \
dead, or the call rang with no answer at all.
  "wrong_network"          — the practice EXISTS and offers behavioral health, \
but does NOT accept this specific insurance carrier. Use this when the \
practice says things like "we dropped Aetna", "we don't take that insurance \
anymore", "we're out of network with them", or "we never accepted that plan". \
The key signal: the barrier is the INSURANCE, not the services offered.
  "no_behavioral_health"   — the practice DOES accept the carrier but does NOT \
offer behavioral health / mental health / therapy services at all. Use this \
only when the practice accepts the insurance but says they don't provide \
mental health care (e.g. "we're a cardiology office", "we don't do therapy").
  "not_accepting_patients" — the practice accepts the carrier for behavioral \
health but is currently CLOSED TO NEW PATIENTS.
  "wrong_provider"         — the number belongs to a completely different \
practice or person than listed in the directory.
  "retired"                — the provider is retired, deceased, or no longer \
practicing at this location.
  "wrong_specialty"        — listed as behavioral health but the practice \
confirmed they are a different specialty entirely.
  "referral_only"          — the practice requires a referral not disclosed in \
the directory, creating an undisclosed access barrier.

Decision rule: if the practice mentions dropping, not accepting, or being out \
of network with the carrier → "wrong_network". Only use "no_behavioral_health" \
if the carrier is accepted but behavioral health services are not offered.

Otherwise set ghost_reason to null.

Write a concise 1-sentence summary describing what happened on the call.

NOTE: The transcript may contain speech-to-text errors (e.g. carrier name \
garbled). Use context to interpret intent.

Respond with ONLY valid JSON, no markdown fences:
{"status": "...", "ghost_reason": "...", "summary": "..."}"""

_RAG_INSTRUCTION = """\
You are a paralegal assistant preparing a formal regulatory complaint exhibit.

You will receive a JSON object with:
- "carrier": insurance carrier name
- "zip_code": member ZIP code
- "ghost_rate": fraction of ghost listings found (0.0–1.0, e.g. 0.72)
- "rag_hits": list of objects each with "source" and "excerpt" fields

Synthesize the most legally relevant findings into exactly 3–4 clean, \
professional bullet points suitable for a formal complaint exhibit titled \
"Regulatory Basis."

Each bullet must:
- Begin with the statute, rule, or case name in bold (e.g. **NY Insurance \
Law §3241**)
- State the specific obligation or precedent in one sentence
- Be free of OCR artifacts, mid-word fragments, or incomplete citations

Output only the bullet points — no preamble, no closing statement."""

_SYNTHESIZER_INSTRUCTION = """\
You are helping a patient write the body of a formal complaint letter about \
an inaccurate insurance provider directory.

You will receive a JSON object with:
- "carrier": insurance carrier name
- "zip_code": member ZIP code
- "ghost_rate": fraction of ghost listings (0.0–1.0)
- "rag_context": newline-separated regulatory context string

Write exactly 3 paragraphs as the body of a Statement of Fact for the \
NY Attorney General Health Care Bureau. The recipient address and patient \
info will be added separately — write only the body text.

Paragraph 1 — Findings: State that the patient is reporting a systemic ghost \
network pattern in the carrier's behavioral health directory. Note the ghost \
rate from an independent AI-voice audit. Reference the NY OAG v. EmblemHealth \
Assurance of Discontinuance (Feb 2026, $2.5M settlement) as precedent.

Paragraph 2 — Regulatory violations: Cite (1) NY Insurance Law §3241 — \
network adequacy mandate; (2) MHPAEA 2024/2025 Final Rules on NQTLs — \
inaccessible behavioral health network as discriminatory NQTL; (3) REAL Act \
(H.R. 7148) — unverified providers must be removed within 5 business days; \
(4) NY Insurance Law §3217-a / §4324 — directory accuracy requirements. Use \
any enforcement precedent from rag_context.

Paragraph 3 — Relief requested: Request investigation, MHPAEA NQTL \
compliance assessment, correction of inaccurate listings with member \
notification, and enforcement action where violations are confirmed.

Rules:
- Factual and specific; cite ghost rate and audit method
- Do NOT give legal advice or suggest hiring a lawyer
- Professional, formal, neutral tone
- No salutation, closing, or signature

End your response with this exact disclaimer on a new line:
DISCLAIMER: This letter body was generated by an automated audit tool and is \
not legal advice. Review and edit carefully before filing. Consult a licensed \
attorney if you have questions about your legal rights."""


# ---------------------------------------------------------------------------
# Blueprint builder
# ---------------------------------------------------------------------------

def build_classifier_agent(*, model: str | None = None) -> LlmAgent:
    """Single-node ADK classifier (shared with ac_classify_transcript)."""
    if model is None:
        from ghost_network_buster.config import get_settings  # noqa: PLC0415

        model = get_settings().vertex_pipecat_llm_model
    return LlmAgent(
        name="classifier_agent",
        model=model,
        description="Map transcript + telephony outcome to ghost/real/voicemail classification.",
        instruction=_CLASSIFIER_INSTRUCTION,
    )


def build_complaint_rag_agent(*, model: str | None = None) -> LlmAgent:
    """Regulatory bullet synthesis (ADK LlmAgent; same instruction as legacy path)."""
    if model is None:
        from ghost_network_buster.config import get_settings  # noqa: PLC0415

        model = get_settings().vertex_pipecat_llm_model
    return LlmAgent(
        name="complaint_rag_agent",
        model=model,
        description="Synthesize statutory / regulatory snippets into complaint bullet points.",
        instruction=_RAG_INSTRUCTION,
    )


def build_synthesizer_agent(*, model: str | None = None) -> LlmAgent:
    """Complaint letter body draft (ADK LlmAgent)."""
    if model is None:
        from ghost_network_buster.config import get_settings  # noqa: PLC0415

        model = get_settings().vertex_pipecat_llm_model
    return LlmAgent(
        name="synthesizer_agent",
        model=model,
        description="Draft the Statement of Fact body for a regulatory complaint letter.",
        instruction=_SYNTHESIZER_INSTRUCTION,
    )


def build_audit_agent_blueprint() -> BaseAgent:
    """Serializable tree for GET /api/agents/graph (introspection context — not for live audits)."""
    from ghost_network_buster.pipeline.adk_audit import (  # noqa: PLC0415
        build_audit_root_agent,
        introspection_execution_context,
    )

    return build_audit_root_agent(introspection_execution_context())


# ---------------------------------------------------------------------------
# ADK Runner helper
# ---------------------------------------------------------------------------

async def run_agent_async(
    agent: BaseAgent,
    message: str,
    *,
    app_name: str = "ghost_network_buster",
) -> str:
    """
    Run a single ADK agent with one user message and return the final text response.

    Vertex routing must come from the process environment (set in FastAPI lifespan
    via Settings, or export vars for tests/CLI). Do not mutate os.environ here — it
    is unsafe under concurrent requests.
    """
    from google.adk.runners import Runner
    from google.adk.sessions.in_memory_session_service import InMemorySessionService

    session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name=app_name, session_service=session_service)
    session = await session_service.create_session(app_name=app_name, user_id="system")

    final_text = ""
    async for event in runner.run_async(
        user_id="system",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part(text=message)],
        ),
    ):
        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    final_text += part.text

    return final_text


# ---------------------------------------------------------------------------
# Introspection helper (used by /api/agents/graph)
# ---------------------------------------------------------------------------

def agent_tree_to_dict(agent: BaseAgent) -> dict[str, Any]:
    return {
        "name": agent.name,
        "type": type(agent).__name__,
        "description": agent.description,
        "sub_agents": [agent_tree_to_dict(child) for child in agent.sub_agents],
    }
