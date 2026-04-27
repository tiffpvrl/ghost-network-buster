"""
Vertex AI Gemini-powered complaint narrative generator.

Uses Gemini 2.0 Flash via Vertex AI (google.genai SDK).
Auth: Application Default Credentials — run `gcloud auth application-default login` locally.
On Cloud Run, the service account needs roles/aiplatform.user.

Returns "" on any failure so reports.py always falls back to the template safely.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def synthesize_rag_hits(
    rag_hits: list[dict],
    carrier: str,
    zip_code: str,
    ghost_rate: float,
    gcp_project: str | None,
    vertex_location: str = "us-central1",
) -> str:
    """
    Condense raw RAG chunks into clean, citation-quality regulatory prose.
    Returns "" on failure so callers fall back to raw excerpts.
    """
    if not gcp_project or not rag_hits:
        return ""
    try:
        from google import genai  # type: ignore[import-untyped]

        client = genai.Client(vertexai=True, project=gcp_project, location=vertex_location)

        raw_excerpts = "\n\n".join(
            f"[Source: {h.get('source', 'unknown')}]\n{str(h.get('excerpt', ''))[:500]}"
            for h in rag_hits
        )

        prompt = f"""You are a paralegal assistant preparing a formal regulatory complaint exhibit.

Below are raw excerpts retrieved from regulatory documents (PDFs and markdown files chunked for search).
Some excerpts may contain OCR artifacts, mid-word chunk boundaries, or truncated sentences — ignore those and focus on the legal substance.

Audit context:
- Carrier: {carrier}
- ZIP: {zip_code}
- Ghost rate: {ghost_rate:.0%} of listed behavioral health providers were unreachable or not in network

Raw regulatory excerpts:
{raw_excerpts}

Task: Synthesize the most legally relevant findings into exactly 3–4 clean, professional bullet points suitable for a formal complaint exhibit titled "Regulatory Basis."

Each bullet must:
- Begin with the statute, rule, or case name in bold (e.g. **NY Insurance Law §3241**)
- State the specific obligation or precedent in one sentence
- Be free of OCR artifacts, mid-word fragments, or incomplete citations

Output only the bullet points — no preamble, no closing statement."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = (response.text or "").strip()
        return text if text else ""
    except Exception as exc:
        logger.warning("RAG synthesis failed: %s", exc)
        return ""


def generate_complaint_narrative(
    carrier: str,
    zip_code: str,
    ghost_rate: float,
    rag_hits: list[dict],
    gcp_project: str | None,
    vertex_location: str = "us-central1",
) -> str:
    """
    Returns a 2-3 paragraph factual complaint narrative, or "" on failure/missing project.
    """
    if not gcp_project:
        return ""

    try:
        from google import genai  # type: ignore[import-untyped]

        client = genai.Client(vertexai=True, project=gcp_project, location=vertex_location)

        rag_context = "\n".join(
            f"- [{h.get('source', '')}]: {str(h.get('excerpt', ''))[:250]}"
            for h in (rag_hits or [])[:4]
        )

        prompt = f"""You are helping a patient write the body of a formal complaint letter about an inaccurate insurance provider directory.

Audit findings:
- Insurance carrier: {carrier}
- Member ZIP code: {zip_code}
- Ghost rate observed: {ghost_rate:.0%} of listed behavioral-health providers were unreachable or out-of-network
- Method: AI-voice verification calls were placed to each listed provider asking whether the practice accepts {carrier} for behavioral health and is accepting new patients. Outcomes were logged with transcripts.

Regulatory context retrieved from official sources:
{rag_context if rag_context else "(no regulatory excerpts available)"}

Write exactly 3 paragraphs as the body of a Statement of Fact for the NY Attorney General Health Care Bureau. The recipient address and patient info will be added separately — write only the body text.

Paragraph 1 — Findings: State that the patient is reporting a systemic ghost network pattern in {carrier}'s behavioral health directory for ZIP {zip_code}. Note that {ghost_rate:.0%} of listed providers were ghost listings per an independent AI-voice audit. Reference the NY OAG v. EmblemHealth Assurance of Discontinuance (Feb 2026, $2.5M settlement) as precedent — the AG has already established that directory inaccuracy violates state parity laws.

Paragraph 2 — Regulatory violations: Cite: (1) NY Insurance Law §3241 — network adequacy mandate, any ghost listing is a potential violation; (2) MHPAEA 2024/2025 Final Rules on NQTLs — an inaccessible behavioral health network is a discriminatory nonquantitative treatment limitation creating greater barriers than medical/surgical coverage; (3) the REAL Act (H.R. 7148) — providers unverified for 90+ days must be removed within 5 business days; (4) NY Insurance Law §3217-a / §4324 — directory accuracy disclosure requirements. If enforcement precedent appears in the regulatory context above, cite it.

Paragraph 3 — Relief requested: Request that the Health Care Bureau: (1) investigate {carrier}'s directory accuracy as a systemic matter consistent with the EmblemHealth enforcement action; (2) assess MHPAEA NQTL compliance; (3) require correction of all inaccurate listings and member notification; and (4) take enforcement action where violations are confirmed.

Rules:
- Be factual and specific; cite the ghost rate and audit method
- Do NOT give legal advice; do NOT tell the patient to sue or hire a lawyer
- Keep language professional, formal, and neutral
- Do not include salutation, closing, or signature — those are added separately

End your response with this exact disclaimer on a new line:
DISCLAIMER: This letter body was generated by an automated audit tool and is not legal advice. Review and edit carefully before filing. Consult a licensed attorney if you have questions about your legal rights."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = (response.text or "").strip()
        return text if text else ""

    except Exception as exc:
        logger.warning("Vertex AI complaint narrative failed: %s", exc)
        return ""
