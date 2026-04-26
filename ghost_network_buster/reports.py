"""PDF deliverables (audit summary + complaint draft)."""

from __future__ import annotations

from fpdf import FPDF

from ghost_network_buster.models import AuditState, AuditSummary


def _ascii_pdf_text(text: str) -> str:
    """fpdf core fonts are latin-1; normalize common unicode punctuation."""
    return (
        (text or "")
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def _paragraphs(state: AuditState, summary: AuditSummary) -> list[str]:
    lines: list[str] = [
        f"Carrier audited: {state.carrier}",
        f"ZIP / region context: {state.zip_code or '-'}",
        f"Care needs selected: {', '.join(state.care_needs) if state.care_needs else '-'}",
        "",
        f"Providers in sample: {summary.providers_total}",
        f"Calls completed: {summary.calls_completed}",
        f"Confirmed real (accepting / usable): {summary.real_count}",
        f"Ghost listings (disconnected / wrong network): {summary.ghost_count}",
        f"Voicemail / unconfirmed: {summary.voicemail_count}",
        f"Ghost rate (ghosts / completed calls): {summary.ghost_rate * 100:.1f}%",
        "",
        "Top verified providers (excerpt):",
    ]
    for i, p in enumerate(summary.top_providers, start=1):
        lines.append(
            f"  {i}. {p.provider_name or p.npi} - {p.summary or ''} "
            f"(verified {p.verified_at or 'n/a'})"
        )
    if not summary.top_providers:
        lines.append("  (none in this run)")
    lines.extend(
        [
            "",
            "Transcript excerpts are included for user verification. "
            "Mock mode uses simulated transcripts; live mode uses call recordings.",
            "",
            f"Voice pipeline: {summary.voice_mode}",
        ]
    )
    return lines


def build_audit_summary_pdf(state: AuditState, summary: AuditSummary) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, _ascii_pdf_text("Ghost Network Buster - Audit summary (draft)"))
    pdf.ln(2)
    pdf.set_font("Helvetica", size=10)
    for block in _paragraphs(state, summary):
        pdf.multi_cell(0, 5, _ascii_pdf_text(block))
        pdf.ln(1)
    return bytes(pdf.output(dest="S"))


def build_complaint_draft_pdf(
    state: AuditState,
    summary: AuditSummary,
    rag_hits: list[dict[str, object]] | None = None,
) -> bytes:
    """Template-style draft for high ghost-rate audits (not legal advice)."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(
        0,
        8,
        _ascii_pdf_text("Draft: Network directory accuracy concern (patient-generated)"),
    )
    pdf.ln(2)
    pdf.set_font("Helvetica", size=10)
    intro = (
        "This draft was produced by an automated audit tool to help patients document "
        "directory accuracy issues. It is not legal advice. Review and edit before any filing. "
        "Cited frameworks may include MHPAEA network composition expectations and state "
        "directory accuracy rules - verify with current law and your plan documents."
    )
    pdf.multi_cell(0, 5, _ascii_pdf_text(intro))
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 6, _ascii_pdf_text("Legal framing (draft — verify current text)"))
    pdf.set_font("Helvetica", size=10)
    legal = (
        "For New York commercial coverage, directory and network-adequacy expectations may be "
        "framed using: (1) federal transparency and directory rules tied to the No Surprises Act "
        "and related MHPAEA implementation, where inaccurate directories undermine access and "
        "parity; (2) New York Insurance Law §3217-a and §4324 (Open Legislation law id ISC), "
        "which address provider directory accuracy and network adequacy for certain plans; "
        "(3) recent New York enforcement precedent where regulators accepted assurances or "
        "orders over materially inaccurate networks; and (4) the factual pattern below from "
        "this audit. Chain these layers explicitly in any formal complaint and cite the "
        "retrieved excerpts your counsel validates."
    )
    pdf.multi_cell(0, 5, _ascii_pdf_text(legal))
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 6, "Factual summary")
    pdf.set_font("Helvetica", size=10)
    facts = [
        f"Plan / carrier referenced in calls: {state.carrier}",
        f"Member context (ZIP): {state.zip_code}",
        f"Sample size: {summary.calls_completed} provider listings audited",
        f"Ghost rate observed: {summary.ghost_rate * 100:.1f}% "
        f"({summary.ghost_count} of {summary.calls_completed} calls)",
        "",
        "Method: AI-voice verification calls asked whether the practice accepts the stated "
        "carrier for behavioral health and whether new patients are accepted. "
        "Outcomes were logged with transcripts.",
        "",
        "Representative transcript excerpts:",
    ]
    for line in facts:
        safe = _ascii_pdf_text(line)
        if not safe.strip():
            pdf.ln(3)
            continue
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, safe)
        pdf.ln(1)
    for r in state.results:
        if r.status != "ghost":
            continue
        excerpt = _ascii_pdf_text((r.transcript or "")[:320].replace("\n", " "))
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 4, _ascii_pdf_text(f"- {r.provider_name or r.npi}: {excerpt}..."))
        pdf.ln(1)
    if summary.loop_agent_note:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, _ascii_pdf_text("Loop / QA note"))
        pdf.set_font("Helvetica", size=10)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, _ascii_pdf_text(summary.loop_agent_note))
        pdf.ln(2)
    if rag_hits:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 6, _ascii_pdf_text("Retrieved reference excerpts (RAG)"))
        pdf.set_font("Helvetica", size=9)
        for h in rag_hits:
            src = str(h.get("source", ""))
            ex = str(h.get("excerpt", ""))[:300]
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(0, 4, _ascii_pdf_text(f"- [{src}] {ex}"))
            pdf.ln(0.5)
        pdf.ln(1)
        pdf.set_font("Helvetica", size=10)
    pdf.set_font("Helvetica", size=10)
    pdf.set_x(pdf.l_margin)
    pdf.ln(2)
    pdf.multi_cell(
        0,
        5,
        _ascii_pdf_text(
            "Next steps: attach this summary to your state department of insurance or AG "
            "consumer complaint portal where applicable, with your member ID and plan documents."
        ),
    )
    return bytes(pdf.output(dest="S"))
