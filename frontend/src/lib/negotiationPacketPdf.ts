// Carrier Renewal Negotiation Packet — multi-page PDF generator.
// Produces a professionally formatted, HR-facing renewal packet from a
// NegotiationPacket object. Uses the same shared jsPDF helpers as the
// existing findings memo and executive summary.

import { jsPDF } from "jspdf";
import {
  COLORS,
  drawBanner,
  drawBody,
  drawHeading,
  drawRule,
  ensureRoom,
  LINE,
  MARGIN,
  pct,
  setRgb,
  stampPageFooters,
  todayIso,
  usd,
} from "./pdfShared";
import type { NegotiationPacket } from "./negotiationPacket";

// ── Packet-specific constants ─────────────────────────────────────────────────

const NEGOTIATION_ASKS = [
  {
    ask: "Premium credit or administrative fee reduction",
    rationale:
      "The purchased network did not perform as represented based on verified provider availability during the audit period.",
  },
  {
    ask: "Written network remediation plan within 30 days",
    rationale:
      "Employees were unable to access behavioral health providers listed as in-network. A formal remediation timeline demonstrates carrier accountability.",
  },
  {
    ask: "Quarterly verified directory audit with employer reporting",
    rationale:
      "Point-in-time audits reveal network degradation between renewal cycles. Ongoing verified reporting ensures access commitments are maintained.",
  },
  {
    ask: "Behavioral health access service-level agreement",
    rationale:
      "Measurable standards — such as appointment availability within 10 business days — create enforceable accountability for network performance.",
  },
  {
    ask: "Temporary out-of-network reimbursement accommodation",
    rationale:
      "Employees cannot bear out-of-pocket costs for a network gap that originated from inaccurate directory listings maintained by the carrier.",
  },
  {
    ask: "Dedicated employee escalation pathway",
    rationale:
      "A named carrier contact reduces HR burden when employees report access failures and signals the carrier's commitment to resolution.",
  },
  {
    ask: "Renewal holdback or performance guarantee",
    rationale:
      "Linking a portion of renewal economics to verified network accuracy aligns carrier incentives with employer and employee access expectations.",
  },
];

const CARRIER_DOCUMENTATION_REQUESTS = [
  "Current behavioral health network adequacy analysis by employee geography",
  "Provider directory verification methodology and most recent verification date",
  "Appointment availability standards for outpatient mental health and substance use care",
  "Comparison of behavioral health access metrics to medical/surgical access metrics",
  "Corrective action plan for inaccurate or unavailable listings, including target completion dates",
  "Member reimbursement policy applicable when listed in-network providers are unavailable",
];

// ── Local layout helpers ──────────────────────────────────────────────────────

/**
 * Table where every cell's text is wrapped to fit within its column width.
 * Row height expands to fit the tallest cell, and a new page is inserted when
 * needed before each row. This prevents text from bleeding into adjacent
 * columns or off the right margin.
 *
 * colWidths must sum to 500 (the writable width of a US Letter page with
 * MARGIN = 56 on each side: 612 − 112 = 500).
 */
function drawWrappedTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  colWidths: number[],
  opts: { fontSize?: number; cellPad?: number } = {},
): number {
  const { fontSize = 9, cellPad = 5 } = opts;
  const lh = fontSize + 3.5;
  const pageW = doc.internal.pageSize.getWidth();
  const startX = MARGIN;

  // ── Header row ──────────────────────────────────────────────
  y = ensureRoom(doc, y, lh * 2 + 10);
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x, y);
    x += colWidths[i];
  }
  y += 7;
  doc.setDrawColor(...COLORS.rule);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += lh;

  // ── Data rows ───────────────────────────────────────────────
  for (const row of rows) {
    // Pre-wrap each cell to its column width
    doc.setFontSize(fontSize);
    const cells: string[][] = row.map((cell, i) =>
      doc.splitTextToSize(cell, Math.max(colWidths[i] - cellPad, 8)),
    );
    const maxLines = Math.max(...cells.map((c) => c.length), 1);
    const rowH = maxLines * lh + 5;

    // Ensure room; re-apply style after any page break
    y = ensureRoom(doc, y, rowH);
    setRgb(doc, COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    x = startX;
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x, y);
      x += colWidths[i];
    }

    y += rowH;
  }

  return y;
}

/**
 * Muted note line that correctly wraps long text within the page margins.
 * Replaces raw drawSubtle calls where text might exceed the writable width.
 */
function drawNote(doc: jsPDF, text: string, y: number, size = 8.5): number {
  const pageW = doc.internal.pageSize.getWidth();
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const wrapped: string[] = doc.splitTextToSize(text, pageW - MARGIN * 2);
  const blockH = wrapped.length * (size + 3);
  y = ensureRoom(doc, y, blockH);
  doc.text(wrapped, MARGIN, y);
  return y + blockH + 2;
}

/**
 * Cover-page two-column metrics list. Uses a wide left column (260 pt) so
 * longer label strings like "Most common failure reason" never overlap the
 * value. Values are right-aligned to the second column.
 */
function drawCoverMetrics(
  doc: jsPDF,
  items: [string, string][],
  y: number,
): number {
  const LABEL_W = 262;
  const lh = 15;

  for (const [label, value] of items) {
    y = ensureRoom(doc, y, lh);

    setRgb(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, MARGIN, y);

    setRgb(doc, COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, MARGIN + LABEL_W, y);

    y += lh;
  }
  return y + 4;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function downloadNegotiationPacketPdf(packet: NegotiationPacket): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const { input, summary, marketEvidence, providerEvidence, financialImpact } = packet;

  const org = input.employerName.trim() || "[Employer]";
  const carrier = input.carrierName.trim() || "[Carrier]";
  const plan = input.planName.trim();
  const renewalYear = input.renewalYear.trim() || "Upcoming";
  const period =
    input.auditPeriodStart && input.auditPeriodEnd
      ? `${input.auditPeriodStart} – ${input.auditPeriodEnd}`
      : "Recent audit period";
  const markets =
    input.marketsReviewed.trim() ||
    `${summary.marketsAffected} employee market(s)`;
  const threshold = Math.round(input.ghostRateThreshold * 100);

  const pageW = doc.internal.pageSize.getWidth();

  const DISCLAIMER =
    `Generated ${todayIso()} · Audit period: ${period} · ` +
    "Directional estimates only. Not legal, actuarial, or medical advice. Review with qualified counsel before use.";

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  let y = MARGIN;

  y = drawBanner(doc, "Confidential — For Renewal Negotiation Purposes Only", y);
  y += 36;

  setRgb(doc, COLORS.brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CARRIER RENEWAL NEGOTIATION PACKET", MARGIN, y);
  y += LINE + 6;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const orgLines: string[] = doc.splitTextToSize(org, pageW - MARGIN * 2);
  doc.text(orgLines, MARGIN, y);
  y += orgLines.length * 26;

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const subtitleLines: string[] = doc.splitTextToSize(
    `${carrier} · ${renewalYear} Renewal`,
    pageW - MARGIN * 2,
  );
  doc.text(subtitleLines, MARGIN, y);
  y += subtitleLines.length * (13 + 4);

  doc.setFontSize(10);
  if (plan) {
    const planLines: string[] = doc.splitTextToSize(`Plan: ${plan}`, pageW - MARGIN * 2);
    doc.text(planLines, MARGIN, y);
    y += planLines.length * LINE;
  }
  const periodLines: string[] = doc.splitTextToSize(`Audit period: ${period}`, pageW - MARGIN * 2);
  doc.text(periodLines, MARGIN, y);
  y += periodLines.length * LINE;

  const mktLines: string[] = doc.splitTextToSize(`Employee markets: ${markets}`, pageW - MARGIN * 2);
  doc.text(mktLines, MARGIN, y);
  y += mktLines.length * LINE;

  doc.text(`Generated: ${todayIso()}`, MARGIN, y);
  y += 28;

  y = drawRule(doc, y);
  y += 8;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Key findings at a glance", MARGIN, y);
  y += LINE + 6;

  // Use drawCoverMetrics — wide label column prevents label/value overlap
  y = drawCoverMetrics(doc, [
    ["Verified ghost rate", pct(summary.ghostRate)],
    ["Providers audited", String(summary.totalProvidersAudited)],
    ["Confirmed available", String(summary.confirmedAvailable)],
    ["Ghost or unavailable", String(summary.ghostCount)],
    ["Voicemail or inconclusive", String(summary.voicemailOrInconclusive)],
    ["Employee markets affected", String(summary.marketsAffected)],
    ["Highest ghost-rate market", summary.highestGhostRateMarket],
    ["Most common failure reason", summary.mostCommonFailureReason],
  ], y);

  // ── SECTION 1: EXECUTIVE RENEWAL SUMMARY ──────────────────────────────────
  doc.addPage();
  y = MARGIN;

  y = drawHeading(doc, "1.  Executive Renewal Summary", y);
  y = drawBody(
    doc,
    `During the audit period (${period}), Ghost Network Buster reviewed the behavioral ` +
      `health provider network offered to ${org} employees across ${markets}. The audit ` +
      `found that ${pct(summary.ghostRate)} of listed in-network behavioral health providers ` +
      `were not practically available to employees — they were either unreachable by phone, ` +
      `not accepting new patients, not participating in the listed plan, or associated with ` +
      `an inaccurate directory listing. Of ${summary.totalProvidersAudited} providers audited, ` +
      `only ${summary.confirmedAvailable} were confirmed available.`,
    y,
  );
  y += 8;

  y = drawBody(
    doc,
    `These findings create employee access risk, HR escalation burden, and carrier ` +
      `performance concerns that ${org} should address before accepting the proposed ` +
      `${renewalYear} renewal terms. The audit data in this packet supports requests ` +
      `for carrier remediation, financial concessions, and enforceable service-level commitments.`,
    y,
  );
  y += 8;

  if (input.renewalGoals.trim()) {
    y = drawBody(
      doc,
      `Renewal goals noted by benefits team: ${input.renewalGoals.trim()}`,
      y,
    );
    y += 8;
  }

  // ── SECTION 2: KEY AUDIT METRICS ──────────────────────────────────────────
  y += 12;
  y = drawHeading(doc, "2.  Key Audit Metrics", y);

  // col widths: 310 + 190 = 500
  y = drawWrappedTable(
    doc,
    ["Metric", "Value"],
    [
      ["Total listed providers audited", String(summary.totalProvidersAudited)],
      ["Confirmed available (in-network, accepting new patients)", String(summary.confirmedAvailable)],
      ["Ghost or unavailable listings", String(summary.ghostCount)],
      ["Voicemail or inconclusive outcomes", String(summary.voicemailOrInconclusive)],
      ["Verified ghost rate", pct(summary.ghostRate)],
      ["Employee markets (ZIP codes) reviewed", String(summary.marketsAffected)],
      [
        "Avg. calls required to reach one confirmed provider",
        summary.avgCallsToReachable != null ? String(summary.avgCallsToReachable) : "Not available",
      ],
      ["Highest ghost-rate market", summary.highestGhostRateMarket],
      ["Most common failure reason", summary.mostCommonFailureReason],
    ],
    y,
    [310, 190],
    { fontSize: 9.5 },
  );
  y += 6;
  // drawNote wraps text within margins — prevents right-edge cutoff
  y = drawNote(
    doc,
    "Ghost rate = ghost listings ÷ total calls completed. Voicemail and inconclusive outcomes are tracked separately and excluded from the ghost rate.",
    y,
  );

  // ── SECTION 3: RECOMMENDED CARRIER REQUESTS ───────────────────────────────
  doc.addPage();
  y = MARGIN;

  y = drawHeading(doc, "3.  Recommended Carrier Requests", y);
  y = drawBody(
    doc,
    `The following requests are grounded in the verified audit findings and are appropriate ` +
      `for ${org}'s ${renewalYear} renewal negotiation with ${carrier}. Each request ` +
      `is accompanied by a brief business rationale. HR and benefits counsel should ` +
      `prioritize and adapt these requests based on plan structure and renewal context.`,
    y,
  );
  y += 8;

  // col widths: 192 + 308 = 500
  // drawWrappedTable handles multi-line rationale without column bleed
  y = drawWrappedTable(
    doc,
    ["Carrier Request", "Business Rationale"],
    NEGOTIATION_ASKS.map((a) => [a.ask, a.rationale]),
    y,
    [192, 308],
    { fontSize: 9 },
  );

  // ── SECTION 4: EVIDENCE SUMMARY BY MARKET ─────────────────────────────────
  doc.addPage();
  y = MARGIN;

  y = drawHeading(doc, "4.  Evidence Summary by Market", y);
  y = drawBody(
    doc,
    `The table below summarizes audit findings by employee geography. Elevated ghost rates ` +
      `across multiple markets indicate a systematic carrier network issue rather than ` +
      `an isolated incident.`,
    y,
  );
  y += 8;

  if (marketEvidence.length === 0) {
    y = drawNote(doc, "No market-level data available from current audits.", y);
  } else {
    // col widths: 65+46+54+46+58+64+167 = 500
    y = drawWrappedTable(
      doc,
      ["Market", "Audited", "Available", "Ghost", "Voicemail", "Ghost %", "Primary Failure Pattern"],
      marketEvidence.map((m) => [
        m.marketName,
        String(m.providersAudited),
        String(m.availableCount),
        String(m.ghostCount),
        String(m.voicemailCount),
        pct(m.ghostRate),
        m.primaryFailurePattern,
      ]),
      y,
      [65, 46, 54, 46, 58, 64, 167],
      { fontSize: 9 },
    );
  }
  y += 6;
  y = drawNote(
    doc,
    "Markets are identified by employee ZIP codes reviewed during the audit period noted on the cover page.",
    y,
  );

  // ── SECTION 5: PARITY AND COMPLIANCE RISK FRAMING ─────────────────────────
  y += 16;
  y = ensureRoom(doc, y, LINE * 6);
  y = drawHeading(doc, "5.  Parity and Compliance Risk Considerations", y);
  y = drawBody(
    doc,
    `Behavioral health network access failures may raise parity compliance considerations ` +
      `under the Mental Health Parity and Addiction Equity Act (MHPAEA). When in-network ` +
      `behavioral health providers are substantially less accessible than comparable ` +
      `medical/surgical providers — as measured by verified directory accuracy and ` +
      `appointment availability — self-insured employers may face documentation needs in ` +
      `the event of a regulatory inquiry, member grievance escalation, or plan audit.`,
    y,
  );
  y += 8;

  y = drawBody(
    doc,
    `This packet does not assert that ${carrier} or ${org} has violated any law. The ` +
      `findings here create compliance exposure and documentation needs that require ` +
      `carrier explanation and remediation documentation. ${org} should work with ` +
      `qualified ERISA counsel to assess applicability to its specific plan structure.`,
    y,
  );
  y += 12;

  y = drawHeading(doc, "Carrier Documentation Requests", y);
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (let i = 0; i < CARRIER_DOCUMENTATION_REQUESTS.length; i++) {
    const wrapped: string[] = doc.splitTextToSize(
      `${i + 1}.  ${CARRIER_DOCUMENTATION_REQUESTS[i]}`,
      pageW - MARGIN * 2,
    );
    y = ensureRoom(doc, y, wrapped.length * (10 + 3) + 4);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * (10 + 3) + 4;
  }

  // ── SECTION 6: FINANCIAL IMPACT ESTIMATE ──────────────────────────────────
  doc.addPage();
  y = MARGIN;

  y = drawHeading(doc, "6.  Financial Impact Estimate", y);
  const fi = financialImpact;

  if (fi.proposedAnnualIncrease == null) {
    y = drawBody(
      doc,
      `No renewal increase amount was provided. To complete the financial impact section, ` +
        `HR should add: (1) the carrier's proposed annual renewal increase in dollars, ` +
        `(2) total covered employee headcount, and (3) current annual plan spend or ` +
        `administrative fee. These inputs enable directional concession target calculations.`,
      y,
    );
    y += 8;
    y = drawBody(
      doc,
      `In the absence of financial data, ${org} should prioritize requesting non-monetary ` +
        `concessions as outlined in Section 3, including performance guarantees, ` +
        `out-of-network accommodations, and enhanced network accuracy reporting.`,
      y,
    );
  } else {
    y = drawBody(
      doc,
      `The following financial figures are directional planning anchors for ${org}'s ` +
        `${renewalYear} renewal negotiation. They are not actuarial projections or legal ` +
        `positions. All figures are estimated and should be reviewed by qualified benefits ` +
        `counsel before use in formal negotiations.`,
      y,
    );
    y += 10;

    const consLow =
      fi.conservativeConcessionTarget != null ? usd(fi.conservativeConcessionTarget) : "—";
    const consHigh =
      fi.conservativeConcessionTarget != null
        ? usd(Math.round(fi.conservativeConcessionTarget * 1.67))
        : "—";
    const aggLow =
      fi.aggressiveConcessionTarget != null ? usd(fi.aggressiveConcessionTarget) : "—";
    const aggHigh =
      fi.aggressiveConcessionTarget != null
        ? usd(Math.round(fi.aggressiveConcessionTarget * 1.43))
        : "—";

    // col widths: 290 + 210 = 500
    y = drawWrappedTable(
      doc,
      ["Financial Measure", "Estimated Value"],
      [
        ["Proposed annual renewal increase", usd(fi.proposedAnnualIncrease)],
        [
          "Estimated cost per covered employee",
          fi.costPerCoveredEmployee != null
            ? usd(fi.costPerCoveredEmployee)
            : "Enter headcount to calculate",
        ],
        [
          "Estimated affected employee population",
          fi.estimatedAffectedPopulation != null
            ? `~${fi.estimatedAffectedPopulation.toLocaleString("en-US")} employees`
            : "Enter headcount to calculate",
        ],
        ["Conservative concession target (10–25% of increase)", `~${consLow} – ${consHigh}`],
        ["Aggressive concession target (25–50% of increase)", `~${aggLow} – ${aggHigh}`],
      ],
      y,
      [290, 210],
      { fontSize: 9.5 },
    );
    y += 6;
    y = drawNote(
      doc,
      "Affected population = covered employees × 10% behavioral health prevalence × verified ghost rate. All figures are directional estimates.",
      y,
    );
  }

  y += 16;
  y = drawHeading(
    doc,
    "Non-Monetary Concessions (Recommended Regardless of Financial Data)",
    y,
  );
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const item of fi.nonMonetaryConcessions) {
    const wrapped: string[] = doc.splitTextToSize(`•  ${item}`, pageW - MARGIN * 2);
    y = ensureRoom(doc, y, wrapped.length * (10 + 3) + 2);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * (10 + 3) + 2;
  }

  // ── SECTION 7: RECOMMENDED CONTRACT LANGUAGE ──────────────────────────────
  doc.addPage();
  y = MARGIN;

  y = drawHeading(doc, "7.  Recommended Renewal Contract Language", y);
  y = drawBody(
    doc,
    `The following is sample contract language ${org} may request during the ` +
      `${renewalYear} renewal. This language is illustrative only. HR and ERISA ` +
      `counsel should review and adapt to the specific plan structure and jurisdiction ` +
      `before use in any binding document or negotiation.`,
    y,
  );
  y += 12;

  const contractText =
    `Carrier will maintain an accurate behavioral health provider directory and will ` +
    `verify provider participation, contact information, plan acceptance, and new-patient ` +
    `availability at least quarterly. Carrier will provide ${org} with a quarterly network ` +
    `accuracy report covering the employer's primary employee geographies. If verified ` +
    `ghost-network rates exceed ${threshold}% in any reviewed market, Carrier will provide ` +
    `a written corrective action plan within 30 days and will make reasonable out-of-network ` +
    `reimbursement accommodations for affected members until access is restored. Carrier will ` +
    `designate a named point of contact for employer escalation of member access failures, ` +
    `with a target response time of two business days.`;

  const contractWrapped: string[] = doc.splitTextToSize(
    contractText,
    pageW - MARGIN * 2 - 24,
  );
  const boxHeight = contractWrapped.length * 13 + 24;
  y = ensureRoom(doc, y, boxHeight + 12);
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(...COLORS.rule);
  doc.rect(MARGIN, y - 10, pageW - MARGIN * 2, boxHeight, "FD");
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(contractWrapped, MARGIN + 12, y + 4);
  y += boxHeight + 8;

  y = drawNote(
    doc,
    `Ghost-rate threshold above (${threshold}%) is a suggested placeholder. Adjust based on network type, plan geography, and counsel guidance.`,
    y,
  );

  // ── SECTION 8: FINAL RENEWAL POSITION ─────────────────────────────────────
  y += 20;
  y = ensureRoom(doc, y, LINE * 8);
  y = drawHeading(doc, "8.  Final Renewal Position", y);

  y = drawBody(
    doc,
    `Based on the verified ghost rate of ${pct(summary.ghostRate)} and repeated access ` +
      `failures across ${summary.marketsAffected} employee market(s), ${org} should not ` +
      `accept the proposed ${renewalYear} renewal terms from ${carrier} without: ` +
      `(1) a written network remediation commitment with target completion dates, ` +
      `(2) measurable access reporting on a quarterly basis, and ` +
      `(3) either financial concessions reflecting the network's underperformance or ` +
      `temporary out-of-network reimbursement accommodations for employees who cannot ` +
      `access listed behavioral health providers.`,
    y,
  );
  y += 8;

  y = drawBody(
    doc,
    summary.ghostRate > 0.4
      ? `At a verified ghost rate above 40%, practical network availability is severely ` +
        `limited. ${org} should consider whether ${carrier} can remediate meaningfully ` +
        `within the renewal cycle and may wish to evaluate alternative network options in parallel.`
      : `${org} maintains a constructive posture toward renewal. The intent of this ` +
        `packet is to document verified access findings and negotiate reasonable ` +
        `remediation — not to create adversarial positioning with the carrier.`,
    y,
  );

  // ── APPENDIX A: PROVIDER-LEVEL EVIDENCE ───────────────────────────────────
  if (providerEvidence.length > 0) {
    doc.addPage();
    y = MARGIN;

    y = drawHeading(doc, "Appendix A:  Provider-Level Evidence", y);
    y = drawBody(
      doc,
      `The table below lists sampled provider outcomes from the audit period. ` +
        `Ghost outcomes are listed first. Evidence type indicates the nature of the ` +
        `verification finding. Transcript excerpts reflect what reception staff stated ` +
        `on the verification call. No personal health information is included.`,
      y,
    );
    y += 4;
    y = drawNote(
      doc,
      `Showing up to ${providerEvidence.length} sampled providers. Full call logs are available in the evidence CSV export.`,
      y,
    );
    y += 4;

    // col widths: 128+52+130+38+58+94 = 500
    // All columns are wide enough for their longest expected value at 8pt font.
    // drawWrappedTable handles any overflow gracefully with multi-line cells.
    y = drawWrappedTable(
      doc,
      ["Provider", "Result", "Failure Reason", "ZIP", "Date", "Evidence Type"],
      providerEvidence.map((p) => [
        p.providerName,
        p.auditResult,
        p.failureReason,
        p.zipCode,
        p.callTimestamp,
        p.evidenceType,
      ]),
      y,
      [128, 52, 130, 38, 58, 94],
      { fontSize: 8 },
    );
  }

  // ── FOOTER ON EVERY PAGE ──────────────────────────────────────────────────
  stampPageFooters(doc, DISCLAIMER);

  const safeName =
    org
      .slice(0, 24)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "employer";
  doc.save(`gnb-renewal-packet-${safeName}-${todayIso()}.pdf`);
}
