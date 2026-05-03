// Shared low-level jsPDF helpers used by the negotiation packet generators
// (findings memo + executive summary). Pure formatting primitives — no business
// data or product copy lives here so the same helpers can be reused for any
// future PDF artifact.

import { jsPDF } from "jspdf";

export const MARGIN = 56;
export const LINE = 14;
export const SUBLINE = 11;

/**
 * Neutral palette. Body text is dark grey, never red. The brand accent is
 * deliberately muted (slate) so the document reads as a piece of correspondence
 * rather than a marketing flyer.
 */
export const COLORS = {
  text: [22, 28, 36] as const,
  muted: [96, 110, 122] as const,
  rule: [220, 226, 232] as const,
  brand: [11, 110, 140] as const,
  banner: [200, 210, 220] as const,
  bannerText: [60, 72, 84] as const,
} as const;

export type RGB = readonly [number, number, number];

export function setRgb(doc: jsPDF, [r, g, b]: RGB): void {
  doc.setTextColor(r, g, b);
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format an ISO timestamp as YYYY-MM-DD or "—" for null/empty. */
export function isoDate(v: string | null | undefined): string {
  if (!v) return "—";
  return v.slice(0, 10);
}

export function ensureRoom(doc: jsPDF, y: number, needed = LINE * 4): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function drawHeading(doc: jsPDF, text: string, y: number): number {
  y = ensureRoom(doc, y, LINE * 2);
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(text, MARGIN, y);
  return y + LINE + 2;
}

export function drawSubtle(
  doc: jsPDF,
  text: string,
  y: number,
  size = 9,
): number {
  y = ensureRoom(doc, y, SUBLINE);
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.text(text, MARGIN, y);
  return y + SUBLINE;
}

export function drawBody(
  doc: jsPDF,
  text: string,
  y: number,
  size = 10,
): number {
  setRgb(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const wrapped = doc.splitTextToSize(
    text,
    doc.internal.pageSize.getWidth() - MARGIN * 2,
  );
  const lineHeight = size + 3;
  y = ensureRoom(doc, y, lineHeight * wrapped.length);
  doc.text(wrapped, MARGIN, y);
  return y + wrapped.length * lineHeight;
}

export function drawRule(doc: jsPDF, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  return y + 8;
}

/**
 * Render a simple multi-column table. Column widths are in points and must
 * sum to the writeable width.
 */
export function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  colWidths: number[],
): number {
  y = ensureRoom(doc, y, LINE * (Math.min(rows.length, 4) + 2));
  const startX = MARGIN;

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

/**
 * Two-column "label : value" grid used for memorandum headers (To / From /
 * Re / Date / Period).
 */
export function drawLabelValueGrid(
  doc: jsPDF,
  items: [string, string][],
  y: number,
): number {
  const labelWidth = 70;
  const lineHeight = 14;
  const totalWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  for (const [label, value] of items) {
    y = ensureRoom(doc, y, lineHeight);
    setRgb(doc, COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), MARGIN, y);

    setRgb(doc, COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(value, totalWidth - labelWidth);
    doc.text(wrapped, MARGIN + labelWidth, y);
    y += Math.max(lineHeight, wrapped.length * (10 + 3));
  }
  return y + 2;
}

/**
 * Plain underline + label/role placeholder for a signature block.
 * Two stacked underlines: one for the named lead, one for the date.
 */
export function drawSignatureBlock(
  doc: jsPDF,
  name: string,
  role: string,
  y: number,
): number {
  y = ensureRoom(doc, y, LINE * 6);
  const w = doc.internal.pageSize.getWidth();
  const lineWidth = 220;

  doc.setDrawColor(...COLORS.text);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + lineWidth, y);
  doc.line(w - MARGIN - lineWidth, y, w - MARGIN, y);

  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 12;
  doc.text(name || "Authorized signatory", MARGIN, y);
  doc.text("Date", w - MARGIN - lineWidth, y);

  y += LINE;
  setRgb(doc, COLORS.muted);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(role, MARGIN, y);

  return y + LINE;
}

/**
 * Top-of-document banner with a muted fill and bold-but-plain text. Used to
 * mark the memo as a draft for counsel review.
 */
export function drawBanner(doc: jsPDF, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const bannerHeight = 22;
  doc.setFillColor(...COLORS.banner);
  doc.rect(MARGIN, y, w - MARGIN * 2, bannerHeight, "F");

  setRgb(doc, COLORS.bannerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(text.toUpperCase(), MARGIN + 10, y + 14);
  return y + bannerHeight + 8;
}

/**
 * Stamp every page of the document with a compact footer that includes a
 * disclaimer and "Page X of Y". Call this once after all content has been
 * drawn, since it relies on the final page count.
 */
export function stampPageFooters(doc: jsPDF, disclaimer: string): void {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setRgb(doc, COLORS.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const wrapped = doc.splitTextToSize(disclaimer, w - MARGIN * 2 - 80);
    doc.text(wrapped, MARGIN, h - MARGIN + 6);

    doc.setFont("helvetica", "normal");
    const pageStr = `Page ${i} of ${pageCount}`;
    const tw = doc.getTextWidth(pageStr);
    doc.text(pageStr, w - MARGIN - tw, h - MARGIN + 6);
  }
}
