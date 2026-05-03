// One-page executive summary for brokers, CFOs, and benefits committees.
// Pairs with the formal findings memo and the evidence CSV in the
// negotiation packet — kept deliberately to a single letter page.

import { jsPDF } from "jspdf";
import {
  derivePeriod,
  estimateExposureUsd,
  type EmployerAggregates,
} from "../data/employerAggregates";
import {
  COLORS,
  drawSubtle,
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

export type ExecSummaryOpts = {
  headcount: number;
  orgName?: string;
};

const DISCLAIMER =
  "Generated " +
  todayIso() +
  " from internal verification audits. Draft for counsel review. " +
  "Not legal, actuarial, or medical advice.";

function drawKpi(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
): void {
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, 64);

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x + 12, y + 18);

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(value, x + 12, y + 48);
}

function drawMiniTable(
  doc: jsPDF,
  title: string,
  rows: [string, string][],
  x: number,
  y: number,
  width: number,
): number {
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, x, y);
  y += 12;
  doc.setDrawColor(...COLORS.rule);
  doc.line(x, y, x + width, y);
  y += 12;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (rows.length === 0) {
    setRgb(doc, COLORS.muted);
    doc.setFont("helvetica", "italic");
    doc.text("No data yet.", x, y);
    return y + LINE;
  }
  for (const [k, v] of rows) {
    doc.text(k, x, y);
    const tw = doc.getTextWidth(v);
    doc.text(v, x + width - tw, y);
    y += LINE;
  }
  return y;
}

export function downloadExecutiveSummary(
  agg: EmployerAggregates,
  opts: ExecSummaryOpts,
): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const org = (opts.orgName?.trim() || "[Organization]").trim();
  const period = derivePeriod();
  const periodStr = period
    ? `${isoDate(period.from)} – ${isoDate(period.to)}`
    : "Recent verification activity";

  let y = MARGIN;

  // ── Title bar ──────────────────────────────────────────────
  setRgb(doc, COLORS.brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EXECUTIVE SUMMARY", MARGIN, y);
  y += LINE;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Network adequacy — behavioral health", MARGIN, y + 4);
  y += 24;

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${org}  ·  ${periodStr}`, MARGIN, y);
  y += 18;

  doc.setDrawColor(...COLORS.rule);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 16;

  // ── Three big KPIs ─────────────────────────────────────────
  const exposure = estimateExposureUsd(agg, opts.headcount);
  const colWidth = (w - MARGIN * 2 - 16) / 3;
  drawKpi(doc, MARGIN, y, colWidth, "Verified ghost rate", pct(agg.totals.ghostRate));
  drawKpi(doc, MARGIN + colWidth + 8, y, colWidth, "Real listings", String(agg.totals.realCount));
  drawKpi(doc, MARGIN + (colWidth + 8) * 2, y, colWidth, "Exposure / yr", usd(exposure));
  y += 78;

  // ── Worst 3 carriers + worst 3 ZIPs ────────────────────────
  const halfWidth = (w - MARGIN * 2 - 24) / 2;
  const worstCarriers = agg.byCarrier.slice(0, 3).map(
    (c) => [c.carrier, pct(c.ghostRate)] as [string, string],
  );
  const worstZips = agg.byZip
    .slice(0, 3)
    .map(
      (z) =>
        [
          z.zip,
          `${z.realCount} real / ${z.ghostCount} ghost`,
        ] as [string, string],
    );

  const yA = drawMiniTable(doc, "Worst three carriers", worstCarriers, MARGIN, y, halfWidth);
  const yB = drawMiniTable(
    doc,
    "Worst three ZIPs",
    worstZips,
    MARGIN + halfWidth + 24,
    y,
    halfWidth,
  );
  y = Math.max(yA, yB) + 12;

  // ── Bold ask ───────────────────────────────────────────────
  doc.setDrawColor(...COLORS.rule);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 18;

  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const askLines = doc.splitTextToSize(
    `Ask: written remediation plan for the carriers, ZIPs, and care needs above, ` +
      `delivered within thirty (30) days of receipt, with a renewal-cycle review.`,
    w - MARGIN * 2,
  );
  y = ensureRoom(doc, y, askLines.length * (12 + 4));
  doc.text(askLines, MARGIN, y);
  y += askLines.length * (12 + 4) + 6;

  // ── Caption ────────────────────────────────────────────────
  y = drawSubtle(
    doc,
    `Sample: ${agg.totals.audits} audit${agg.totals.audits === 1 ? "" : "s"}, ` +
      `${agg.totals.callsCompleted} verification calls. ` +
      `Findings memorandum and per-call evidence available alongside this summary.`,
    y,
  );

  // ── Footer on every page ───────────────────────────────────
  stampPageFooters(doc, DISCLAIMER);

  doc.save(`gnb-exec-summary-${todayIso()}.pdf`);
}
