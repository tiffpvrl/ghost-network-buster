// RFC4180-style CSV writer for the per-call evidence export.
// Uses CRLF line endings, escapes fields containing commas, quotes, or
// newlines by wrapping in double-quotes and doubling embedded quotes, and
// prepends a UTF-8 BOM so Excel opens the file with the correct encoding.

import type { EvidenceRow } from "../data/employerAggregates";
import { todayIso } from "./pdfShared";

const HEADERS: (keyof EvidenceRow)[] = [
  "auditDate",
  "carrier",
  "zip",
  "auditId",
  "npi",
  "providerName",
  "status",
  "ghostReason",
  "summary",
  "verifiedAt",
];

function escapeField(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // RFC4180: wrap in quotes if the value contains a comma, quote, CR, or LF.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: EvidenceRow[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.join(","));
  for (const row of rows) {
    lines.push(HEADERS.map((k) => escapeField(row[k])).join(","));
  }
  // RFC4180 specifies CRLF between records.
  return lines.join("\r\n") + "\r\n";
}

export function downloadEvidenceCsv(rows: EvidenceRow[]): void {
  const csv = rowsToCsv(rows);
  // UTF-8 BOM (\uFEFF) so Excel auto-detects the encoding on Windows.
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gnb-evidence-${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
