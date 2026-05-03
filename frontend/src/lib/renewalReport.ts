// One-click renewal report PDF — generated entirely in the browser via jsPDF.
// Uses only the aggregator output and a few formatting helpers, so it is not
// coupled to any backend endpoint.

import { jsPDF } from "jspdf";
import {
  estimateExposureUsd,
  PRODUCTIVITY_LOSS_PER_UNTREATED_USD,
  BASELINE_BH_PREVALENCE,
  type EmployerAggregates,
} from "../data/employerAggregates";

type ReportOpts = {
  headcount: number;
  org?: string;
};

const MARGIN = 56;
const LINE = 14;
const SUBLINE = 11;

const COLORS = {
  text: [22, 28, 36] as const,
  muted: [96, 110, 122] as const,
  rule: [220, 226, 232] as const,
  brand: [11, 110, 140] as const,
  ghost: [183, 28, 28] as const,
};

function setRgb(doc: jsPDF, [r, g, b]: readonly [number, number, number]) {
  doc.setTextColor(r, g, b);
}

function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureRoom(doc: jsPDF, y: number, needed = LINE * 4): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawHeading(doc: jsPDF, text: string, y: number): number {
  y = ensureRoom(doc, y, LINE * 2);
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(text, MARGIN, y);
  return y + LINE + 2;
}

function drawSubtle(doc: jsPDF, text: string, y: number, size = 9): number {
  y = ensureRoom(doc, y, SUBLINE);
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.text(text, MARGIN, y);
  return y + SUBLINE;
}

function drawBody(doc: jsPDF, text: string, y: number, size = 10): number {
  y = ensureRoom(doc, y, LINE);
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const wrapped = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - MARGIN * 2);
  doc.text(wrapped, MARGIN, y);
  return y + wrapped.length * (size + 3);
}

function drawRule(doc: jsPDF, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  return y + 8;
}

function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  colWidths: number[],
): number {
  y = ensureRoom(doc, y, LINE * (rows.length + 2));
  const startX = MARGIN;

  // header row
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x, y);
    x += colWidths[i];
  }
  y += 6;
  doc.setDrawColor(...COLORS.rule);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
  y += 12;

  // body rows
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const row of rows) {
    y = ensureRoom(doc, y, LINE);
    x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x, y);
      x += colWidths[i];
    }
    y += LINE;
  }
  return y;
}

export function downloadRenewalReport(agg: EmployerAggregates, opts: ReportOpts): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  // ── Header ─────────────────────────────────────────────────
  setRgb(doc, COLORS.brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GHOST NETWORK BUSTER", MARGIN, MARGIN);

  setRgb(doc, COLORS.text);
  doc.setFontSize(20);
  doc.text("Network Adequacy Audit", MARGIN, MARGIN + 22);

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const headerLine = `Renewal-ready report  ·  ${todayIso()}${opts.org ? `  ·  ${opts.org}` : ""}`;
  doc.text(headerLine, MARGIN, MARGIN + 38);

  let y = MARGIN + 56;
  y = drawRule(doc, y);

  // ── Executive summary ──────────────────────────────────────
  y = drawHeading(doc, "Executive summary", y);
  const exposure = estimateExposureUsd(agg, opts.headcount);
  y = drawBody(
    doc,
    `Across ${agg.totals.audits} audit${agg.totals.audits === 1 ? "" : "s"} ` +
      `(${agg.totals.batches} batch${agg.totals.batches === 1 ? "" : "es"}), ` +
      `${agg.totals.callsCompleted} verification calls were placed. ` +
      `Weighted ghost rate: ${pct(agg.totals.ghostRate)}. ` +
      `Confirmed real listings: ${agg.totals.realCount}. ` +
      `Estimated annual productivity exposure at ${opts.headcount.toLocaleString("en-US")} covered lives: ${usd(exposure)}.`,
    y,
  );
  y += 8;

  // ── Ghost rate by carrier ──────────────────────────────────
  y = drawHeading(doc, "Ghost rate by carrier", y);
  if (agg.byCarrier.length === 0) {
    y = drawSubtle(doc, "No audit data available yet.", y);
  } else {
    const rows = agg.byCarrier.map((c) => [
      c.carrier,
      pct(c.ghostRate),
      String(c.audits),
      String(c.calls),
    ]);
    y = drawTable(doc, ["Carrier", "Ghost rate", "Audits", "Calls"], rows, y, [220, 100, 70, 70]);
  }
  y += 6;

  // ── Coverage gaps by ZIP ───────────────────────────────────
  y = drawHeading(doc, "Coverage gaps by ZIP (worst first)", y);
  if (agg.byZip.length === 0) {
    y = drawSubtle(doc, "No ZIP-level data available yet.", y);
  } else {
    const top = agg.byZip.slice(0, 5).map((z) => [
      z.zip,
      String(z.realCount),
      String(z.ghostCount),
      String(z.audits),
    ]);
    y = drawTable(doc, ["ZIP", "Real", "Ghost", "Audits"], top, y, [120, 80, 80, 80]);
  }
  y += 6;

  // ── Broken specialty callouts ──────────────────────────────
  y = drawHeading(doc, "Broken specialty callouts", y);
  if (agg.brokenSpecialties.length === 0) {
    y = drawSubtle(doc, "No specialties returned zero real listings in this audit set.", y);
  } else {
    setRgb(doc, COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const b of agg.brokenSpecialties) {
      y = ensureRoom(doc, y, LINE);
      doc.text(`•  ${b.need}: 0 real providers across ${b.auditsWithNeed} audit${b.auditsWithNeed === 1 ? "" : "s"}.`, MARGIN, y);
      y += LINE;
    }
  }
  y += 6;

  // ── Financial exposure ─────────────────────────────────────
  y = drawHeading(doc, "Financial exposure estimate", y);
  setRgb(doc, COLORS.ghost);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  y = ensureRoom(doc, y, 24);
  doc.text(usd(exposure), MARGIN, y);
  y += 22;

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y = drawBody(
    doc,
    `Headcount ${opts.headcount.toLocaleString("en-US")} × ${pct(BASELINE_BH_PREVALENCE, 0)} baseline ` +
      `behavioral-health prevalence × ${pct(agg.totals.ghostRate)} weighted ghost rate × ` +
      `${usd(PRODUCTIVITY_LOSS_PER_UNTREATED_USD)}/year per untreated case. Order-of-magnitude planning anchor only.`,
    y,
    9,
  );
  y += 8;

  // ── Footer / disclaimer ────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const footer =
    "Illustrative — generated client-side from simulated audits in this prototype. " +
    "Not legal, actuarial, or medical advice. Verify with counsel before regulatory use.";
  const wrapped = doc.splitTextToSize(footer, pageWidth - MARGIN * 2);
  doc.text(wrapped, MARGIN, pageHeight - MARGIN + 8);

  doc.save(`gnb-renewal-report-${todayIso()}.pdf`);
}
