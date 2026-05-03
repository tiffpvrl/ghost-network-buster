// Network Adequacy Findings Memorandum — formal counsel-ready PDF generated
// entirely client-side. Replaces the earlier "renewal report" deliverable
// with a multi-page memorandum: banner, To/From/Re/Date block, executive
// summary, methodology, findings, member impact, limitations, requested
// action, signature block, and per-page footer with "Page X of Y".

import { jsPDF } from "jspdf";
import {
  derivePeriod,
  estimateExposureUsd,
  PRODUCTIVITY_LOSS_PER_UNTREATED_USD,
  BASELINE_BH_PREVALENCE,
  type EmployerAggregates,
} from "../data/employerAggregates";
import {
  COLORS,
  drawBanner,
  drawBody,
  drawHeading,
  drawLabelValueGrid,
  drawRule,
  drawSignatureBlock,
  drawSubtle,
  drawTable,
  ensureRoom,
  isoDate,
  LINE,
  MARGIN,
  pct,
  setRgb,
  stampPageFooters,
  todayIso,
  usd,
} from "./pdfShared";

export type FindingsMemoOpts = {
  headcount: number;
  orgName?: string;
  benefitsLead?: string;
};

const DISCLAIMER =
  "Generated " +
  todayIso() +
  " from internal verification audits. Draft for counsel review. " +
  "Not legal, actuarial, or medical advice.";

export function downloadFindingsMemo(
  agg: EmployerAggregates,
  opts: FindingsMemoOpts,
): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const org = (opts.orgName?.trim() || "[Organization]").trim();
  const lead = (opts.benefitsLead?.trim() || "[Benefits lead]").trim();
  const period = derivePeriod();
  const periodStr = period
    ? `${isoDate(period.from)} – ${isoDate(period.to)}`
    : "Recent verification activity";

  let y = MARGIN;

  // ── Banner ─────────────────────────────────────────────────
  y = drawBanner(doc, "Draft for counsel review — coordinate with legal before submission", y);

  // ── Memorandum eyebrow + title ─────────────────────────────
  setRgb(doc, COLORS.brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("MEMORANDUM", MARGIN, y);
  y += LINE;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Network Adequacy Findings", MARGIN, y + 4);
  y += 26;

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Behavioral health directory verification", MARGIN, y);
  y += LINE;

  y = drawRule(doc, y);

  // ── To / From / Re / Date block ────────────────────────────
  y = drawLabelValueGrid(
    doc,
    [
      ["To", "Carrier network operations"],
      ["From", `${org} — Benefits team`],
      ["Re", "Network adequacy findings, behavioral health directory"],
      ["Date", todayIso()],
      ["Period", periodStr],
    ],
    y,
  );
  y = drawRule(doc, y);

  // ── Executive summary + ask ────────────────────────────────
  const exposure = estimateExposureUsd(agg, opts.headcount);
  y = drawHeading(doc, "Executive summary", y);
  y = drawBody(
    doc,
    `${org} conducted ${agg.totals.audits} directory-verification ` +
      `audit${agg.totals.audits === 1 ? "" : "s"} ` +
      `(${agg.totals.batches} batch${agg.totals.batches === 1 ? "" : "es"}) ` +
      `placing ${agg.totals.callsCompleted} phone calls to listed behavioral-health providers. ` +
      `The weighted verified ghost rate across the sample was ${pct(agg.totals.ghostRate)}. ` +
      `${agg.totals.realCount} listing${agg.totals.realCount === 1 ? "" : "s"} ` +
      `confirmed availability and accepted the listed plan. ` +
      `As a planning anchor at ${opts.headcount.toLocaleString("en-US")} covered lives, ` +
      `the productivity exposure associated with untreated behavioral-health need at the observed ghost rate ` +
      `is approximately ${usd(exposure)} per year.`,
    y,
  );
  y += 4;
  y = drawBody(
    doc,
    `We request a written remediation plan covering directory accuracy and member ` +
      `communication for the items below within thirty (30) days of receipt, and a ` +
      `point of contact for follow-up verification.`,
    y,
  );
  y += 6;

  // ── Methodology ────────────────────────────────────────────
  y = drawHeading(doc, "Methodology", y);
  y = drawBody(
    doc,
    `Listings were sampled from the carrier directory by carrier, ZIP, and stated ` +
      `care need. Each listing was contacted by phone and the call outcome was ` +
      `classified as "real" (provider accepted the listed plan and offered an ` +
      `appointment), "ghost" (number disconnected, wrong office, not accepting the ` +
      `plan, or not accepting new patients), "voicemail," "no answer," or "error." ` +
      `Reception statements regarding plan acceptance were recorded as stated and ` +
      `are not equivalent to claims-level coverage adjudication. ` +
      `No member-identifiable data, claims data, or PHI were collected or analyzed. ` +
      `Audit metadata is retained for internal record only and is not published.`,
    y,
  );
  y += 6;

  // ── Findings — ghost rate by carrier ───────────────────────
  y = drawHeading(doc, "Findings — verified ghost rate by carrier", y);
  if (agg.byCarrier.length === 0) {
    y = drawSubtle(doc, "No audit data available.", y);
  } else {
    const rows = agg.byCarrier.map((c) => [
      c.carrier,
      pct(c.ghostRate),
      String(c.audits),
      String(c.calls),
    ]);
    y = drawTable(
      doc,
      ["Carrier", "Ghost rate", "Audits", "Calls"],
      rows,
      y,
      [220, 100, 70, 70],
    );
  }
  y += 6;

  // ── Findings — coverage gaps by ZIP ────────────────────────
  y = drawHeading(doc, "Findings — coverage gaps by ZIP", y);
  if (agg.byZip.length === 0) {
    y = drawSubtle(doc, "No ZIP-level data available.", y);
  } else {
    const rows = agg.byZip.slice(0, 10).map((z) => [
      z.zip,
      String(z.realCount),
      String(z.ghostCount),
      String(z.audits),
    ]);
    y = drawTable(
      doc,
      ["ZIP", "Real", "Ghost", "Audits"],
      rows,
      y,
      [120, 80, 80, 80],
    );
  }
  y += 6;

  // ── Findings — specialty access ────────────────────────────
  y = drawHeading(doc, "Findings — specialty access", y);
  if (agg.byNeed.length === 0) {
    y = drawSubtle(doc, "No care-need data available.", y);
  } else {
    const rows = agg.byNeed.map((n) => [
      n.need,
      String(n.realInThoseAudits) + (n.realInThoseAudits === 0 ? "  ⚑" : ""),
      String(n.ghostInThoseAudits),
      String(n.auditsWithNeed),
    ]);
    y = drawTable(
      doc,
      ["Care need", "Real listings", "Ghost listings", "Audits"],
      rows,
      y,
      [220, 100, 100, 70],
    );
    y += 4;
    y = drawSubtle(
      doc,
      "⚑ marks care needs returning zero verified real listings in the sampled audits.",
      y,
    );
  }
  y += 6;

  // ── Member impact ──────────────────────────────────────────
  y = drawHeading(doc, "Member impact estimate", y);
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  y = ensureRoom(doc, y, 22);
  doc.text(`${usd(exposure)} / year`, MARGIN, y);
  y += 22;
  y = drawBody(
    doc,
    `Calculation: headcount ${opts.headcount.toLocaleString("en-US")} × ` +
      `${pct(BASELINE_BH_PREVALENCE, 0)} baseline behavioral-health prevalence × ` +
      `${pct(agg.totals.ghostRate)} weighted ghost rate × ` +
      `${usd(PRODUCTIVITY_LOSS_PER_UNTREATED_USD)}/year per untreated case. ` +
      `This is presented as an order-of-magnitude planning anchor; it is not an ` +
      `actuarial loss estimate, claims projection, or medical-cost forecast.`,
    y,
    9,
  );
  y += 6;

  // ── Limitations ────────────────────────────────────────────
  y = drawHeading(doc, "Limitations", y);
  const limits = [
    "Findings reflect a point-in-time sample; carrier directories change continuously.",
    "Reception statements regarding plan acceptance are recorded as stated and are not equivalent to claims adjudication.",
    "Sample sizes vary by carrier and ZIP; per-row figures should be read as directional.",
    "No member-identifiable data, claims data, or PHI were collected or analyzed.",
    "No legal or regulatory conclusions are drawn in this memorandum.",
  ];
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const item of limits) {
    y = ensureRoom(doc, y, LINE);
    const wrapped = doc.splitTextToSize(
      `•  ${item}`,
      doc.internal.pageSize.getWidth() - MARGIN * 2,
    );
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * (10 + 3);
  }
  y += 6;

  // ── Requested action ───────────────────────────────────────
  y = drawHeading(doc, "Requested action", y);
  const actions = [
    "Provide a written corrective-action plan for the carriers, ZIPs, and care needs identified above, including target completion dates.",
    "Update directory listings flagged as inaccurate within the standard remediation window applicable to the carrier's regulatory obligations.",
    "Notify members who have searched the affected directory entries in the prior 90 days, where carrier records permit.",
    "Schedule a renewal-cycle discussion to review remediation progress and contractual implications.",
  ];
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (let i = 0; i < actions.length; i++) {
    y = ensureRoom(doc, y, LINE);
    const wrapped = doc.splitTextToSize(
      `${i + 1}.  ${actions[i]}`,
      doc.internal.pageSize.getWidth() - MARGIN * 2,
    );
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * (10 + 3);
  }
  y += 16;

  // ── Signature block ────────────────────────────────────────
  y = drawSignatureBlock(doc, lead, `${lead === "[Benefits lead]" ? "Benefits lead" : `Benefits lead, ${org}`}`, y);

  // ── Footer on every page ───────────────────────────────────
  stampPageFooters(doc, DISCLAIMER);

  doc.save(`gnb-findings-memo-${todayIso()}.pdf`);
}
