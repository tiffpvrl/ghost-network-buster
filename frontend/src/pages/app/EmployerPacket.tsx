// Carrier Renewal Negotiation Packet — employer-facing generation page.
// Shows a form for renewal context, a live in-page preview of the packet
// sections, and buttons to generate the PDF or export the evidence CSV.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  derivePeriod,
  estimateExposureUsd,
  flatEvidenceRows,
  loadEmployerAggregates,
} from "../../data/employerAggregates";
import { downloadEvidenceCsv } from "../../lib/evidenceCsv";
import {
  assemblePacket,
  type EmployerPacketInput,
} from "../../lib/negotiationPacket";
import { downloadNegotiationPacketPdf } from "../../lib/negotiationPacketPdf";

const DEFAULT_THRESHOLD = 20; // stored as integer percent in the form

function fmtRate(r: number) {
  return `${(r * 100).toFixed(1)}%`;
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function parseNum(s: string): number | null {
  const n = Number(s.replace(/[,$]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Small helper so the preview tables don't require an external component
function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div style={{ overflowX: "auto", marginTop: "0.6rem" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.82rem",
        }}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0.35rem 0.6rem",
                  borderBottom: "1px solid var(--border, #dde0e4)",
                  color: "var(--muted)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid var(--border, #eef0f2)" }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "0.35rem 0.6rem",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployerPacket() {
  const agg = useMemo(() => loadEmployerAggregates(), []);
  const evidenceRows = useMemo(() => flatEvidenceRows(), []);
  const period = useMemo(() => derivePeriod(), []);
  const hasData = agg.totals.audits > 0;

  // ── Form state ────────────────────────────────────────────────────────────
  const [employerName, setEmployerName] = useState("");
  const [carrierName, setCarrierName] = useState(
    agg.byCarrier[0]?.carrier ?? "",
  );
  const [planName, setPlanName] = useState("");
  const [renewalYear, setRenewalYear] = useState(
    String(new Date().getFullYear() + 1),
  );
  const [periodStart, setPeriodStart] = useState(
    period?.from?.slice(0, 10) ?? "",
  );
  const [periodEnd, setPeriodEnd] = useState(period?.to?.slice(0, 10) ?? "");
  const [marketsReviewed, setMarketsReviewed] = useState(
    agg.byZip.map((z) => `ZIP ${z.zip}`).join(", "),
  );
  const [coveredStr, setCoveredStr] = useState("");
  const [increaseStr, setIncreaseStr] = useState("");
  const [spendStr, setSpendStr] = useState("");
  const [thresholdStr, setThresholdStr] = useState(
    String(DEFAULT_THRESHOLD),
  );
  const [renewalGoals, setRenewalGoals] = useState("");

  // ── Derived packet ────────────────────────────────────────────────────────
  const input = useMemo<EmployerPacketInput>(
    () => ({
      employerName,
      carrierName,
      planName,
      renewalYear,
      auditPeriodStart: periodStart,
      auditPeriodEnd: periodEnd,
      marketsReviewed,
      coveredEmployees: parseNum(coveredStr),
      proposedRenewalIncrease: parseNum(increaseStr),
      annualPlanSpend: parseNum(spendStr),
      renewalGoals,
      ghostRateThreshold: (parseNum(thresholdStr) ?? DEFAULT_THRESHOLD) / 100,
    }),
    [
      employerName,
      carrierName,
      planName,
      renewalYear,
      periodStart,
      periodEnd,
      marketsReviewed,
      coveredStr,
      increaseStr,
      spendStr,
      thresholdStr,
      renewalGoals,
    ],
  );

  const packet = useMemo(
    () => (hasData ? assemblePacket(input, agg, evidenceRows) : null),
    [input, agg, evidenceRows, hasData],
  );

  const coveredEmployees = parseNum(coveredStr);
  const exposure = useMemo(
    () =>
      coveredEmployees != null && coveredEmployees > 0
        ? estimateExposureUsd(agg, coveredEmployees)
        : null,
    [agg, coveredEmployees],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleGeneratePdf() {
    if (!packet) return;
    downloadNegotiationPacketPdf(packet);
  }

  function handleCsv() {
    if (!hasData) return;
    downloadEvidenceCsv(flatEvidenceRows());
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="employer-home">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="patient-home__hero">
        <div className="hero__eyebrow">
          <Link to="/app/employer" style={{ color: "inherit", textDecoration: "none" }}>
            ← Employer workspace
          </Link>
        </div>
        <h1 className="patient-home__title">
          Carrier Renewal Negotiation Packet
        </h1>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          Generate a professional renewal packet HR can bring to a carrier
          renewal meeting. Fill in the employer and renewal details below — the
          packet pulls from your existing audit data automatically.
        </p>
        <div className="hero__actions">
          <button
            type="button"
            className="btn"
            onClick={handleGeneratePdf}
            disabled={!hasData}
            title={!hasData ? "Run a batch audit first to generate the packet." : undefined}
          >
            Generate Renewal Packet (PDF)
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={handleCsv}
            disabled={!hasData}
          >
            Export evidence (CSV)
          </button>
        </div>
        {!hasData && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.85rem",
              color: "var(--muted)",
            }}
          >
            No audit data found.{" "}
            <Link to="/app/employer/audits/new">Run a batch audit</Link> to
            populate the packet.
          </p>
        )}
      </header>

      {/* ── Form: renewal & employer details ─────────────────────────────── */}
      <section className="section">
        <h2 className="section__title">Renewal &amp; Employer Details</h2>
        <div className="card">
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--muted)",
              margin: "0 0 1rem",
            }}
          >
            Used in the packet header, executive summary, contract language, and
            final position. Placeholders are fine — counsel will redline before
            submission.
          </p>

          {/* Row 1 */}
          <div className="report-context">
            <label>
              <span>Employer name</span>
              <input
                type="text"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                placeholder="Acme Corp"
                maxLength={120}
              />
            </label>
            <label>
              <span>Carrier name</span>
              <input
                type="text"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Aetna"
                maxLength={120}
              />
            </label>
          </div>

          {/* Row 2 */}
          <div className="report-context" style={{ marginTop: "0.75rem" }}>
            <label>
              <span>Plan name or type</span>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Behavioral Health PPO"
                maxLength={120}
              />
            </label>
            <label>
              <span>Renewal year</span>
              <input
                type="text"
                value={renewalYear}
                onChange={(e) => setRenewalYear(e.target.value)}
                placeholder={String(new Date().getFullYear() + 1)}
                maxLength={10}
              />
            </label>
          </div>

          {/* Row 3 — audit period */}
          <div className="report-context" style={{ marginTop: "0.75rem" }}>
            <label>
              <span>Audit period start</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label>
              <span>Audit period end</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
          </div>

          {/* Markets */}
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  marginBottom: "0.3rem",
                }}
              >
                Employee markets reviewed{" "}
                <span style={{ fontWeight: 400 }}>
                  (ZIP codes or city/region names, comma-separated)
                </span>
              </span>
              <input
                type="text"
                value={marketsReviewed}
                onChange={(e) => setMarketsReviewed(e.target.value)}
                placeholder="ZIP 10001, ZIP 10002, Manhattan"
                style={{ width: "100%" }}
                maxLength={500}
              />
            </label>
          </div>

          {/* Financial inputs */}
          <h3
            style={{ margin: "1.2rem 0 0.3rem", fontSize: "0.9rem" }}
          >
            Financial inputs{" "}
            <span
              style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--muted)" }}
            >
              (optional — enable financial concession estimates)
            </span>
          </h3>
          <div className="report-context" style={{ marginTop: "0.5rem" }}>
            <label>
              <span>Covered employees</span>
              <input
                type="number"
                min={0}
                step={50}
                value={coveredStr}
                onChange={(e) => setCoveredStr(e.target.value)}
                placeholder="500"
              />
            </label>
            <label>
              <span>Proposed renewal increase ($)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={increaseStr}
                onChange={(e) => setIncreaseStr(e.target.value)}
                placeholder="250000"
              />
            </label>
          </div>
          <div className="report-context" style={{ marginTop: "0.75rem" }}>
            <label>
              <span>Annual plan spend ($, optional)</span>
              <input
                type="number"
                min={0}
                step={10000}
                value={spendStr}
                onChange={(e) => setSpendStr(e.target.value)}
                placeholder="1200000"
              />
            </label>
            <label>
              <span>Ghost-rate threshold for contract language (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step={5}
                value={thresholdStr}
                onChange={(e) => setThresholdStr(e.target.value)}
                placeholder="20"
              />
            </label>
          </div>

          {/* Renewal goals */}
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  marginBottom: "0.3rem",
                }}
              >
                Renewal goals{" "}
                <span style={{ fontWeight: 400 }}>
                  (optional — included in executive summary)
                </span>
              </span>
              <textarea
                value={renewalGoals}
                onChange={(e) => setRenewalGoals(e.target.value)}
                placeholder="Hold premium flat, secure a performance guarantee, add OON accommodation for behavioral health…"
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
                maxLength={600}
              />
            </label>
          </div>
        </div>
      </section>

      {/* ── In-page preview ───────────────────────────────────────────────── */}
      {hasData && packet && (
        <>
          {/* Executive summary */}
          <section className="section">
            <h2 className="section__title">
              Preview: Executive Renewal Summary
            </h2>
            <div className="card">
              <p style={{ lineHeight: 1.7, maxWidth: "72ch" }}>
                During the audit period
                {periodStart && periodEnd
                  ? ` (${periodStart} – ${periodEnd})`
                  : ""}
                , Ghost Network Buster reviewed the behavioral health provider
                network offered to{" "}
                <strong>
                  {employerName.trim() || "[Employer]"}
                </strong>{" "}
                employees across{" "}
                {marketsReviewed.trim() ||
                  `${packet.summary.marketsAffected} employee market(s)`}
                . The audit found that{" "}
                <strong>{fmtRate(packet.summary.ghostRate)}</strong> of listed
                in-network behavioral health providers were not practically
                available to employees. Of{" "}
                {packet.summary.totalProvidersAudited} providers audited, only{" "}
                <strong>{packet.summary.confirmedAvailable}</strong> were
                confirmed available.
              </p>
            </div>
          </section>

          {/* Key metrics */}
          <section className="section">
            <h2 className="section__title">Preview: Key Audit Metrics</h2>
            <div className="card">
              <PreviewTable
                headers={["Metric", "Value"]}
                rows={[
                  [
                    "Total providers audited",
                    String(packet.summary.totalProvidersAudited),
                  ],
                  [
                    "Confirmed available",
                    String(packet.summary.confirmedAvailable),
                  ],
                  [
                    "Ghost or unavailable",
                    String(packet.summary.ghostCount),
                  ],
                  [
                    "Voicemail or inconclusive",
                    String(packet.summary.voicemailOrInconclusive),
                  ],
                  ["Verified ghost rate", fmtRate(packet.summary.ghostRate)],
                  [
                    "Markets affected",
                    String(packet.summary.marketsAffected),
                  ],
                  [
                    "Avg. calls to reach one confirmed provider",
                    packet.summary.avgCallsToReachable != null
                      ? String(packet.summary.avgCallsToReachable)
                      : "—",
                  ],
                  [
                    "Highest ghost-rate market",
                    packet.summary.highestGhostRateMarket,
                  ],
                  [
                    "Most common failure reason",
                    packet.summary.mostCommonFailureReason,
                  ],
                ]}
              />
            </div>
          </section>

          {/* Negotiation asks */}
          <section className="section">
            <h2 className="section__title">
              Preview: Recommended Carrier Requests
            </h2>
            <div className="card">
              <PreviewTable
                headers={["Carrier Request", "Business Rationale"]}
                rows={[
                  [
                    "Premium credit or administrative fee reduction",
                    "The purchased network did not perform as represented based on verified provider availability.",
                  ],
                  [
                    "Written network remediation plan within 30 days",
                    "Employees could not access listed in-network providers. A formal remediation timeline demonstrates accountability.",
                  ],
                  [
                    "Quarterly verified directory audit with employer reporting",
                    "Ongoing verification ensures access commitments are maintained between renewal cycles.",
                  ],
                  [
                    "Behavioral health access service-level agreement",
                    "Measurable access standards create enforceable accountability for network performance.",
                  ],
                  [
                    "Temporary out-of-network reimbursement accommodation",
                    "Employees should not bear out-of-pocket costs for a gap originating from inaccurate carrier listings.",
                  ],
                  [
                    "Dedicated employee escalation pathway",
                    "A named carrier contact reduces HR burden and demonstrates commitment to resolution.",
                  ],
                  [
                    "Renewal holdback or performance guarantee",
                    "Links renewal economics to verified network accuracy, aligning carrier incentives with employer expectations.",
                  ],
                ]}
              />
            </div>
          </section>

          {/* Market evidence */}
          {packet.marketEvidence.length > 0 && (
            <section className="section">
              <h2 className="section__title">
                Preview: Evidence Summary by Market
              </h2>
              <div className="card">
                <PreviewTable
                  headers={[
                    "Market",
                    "Audited",
                    "Available",
                    "Ghost",
                    "Ghost Rate",
                    "Primary Failure",
                  ]}
                  rows={packet.marketEvidence.map((m) => [
                    m.marketName,
                    String(m.providersAudited),
                    String(m.availableCount),
                    String(m.ghostCount),
                    fmtRate(m.ghostRate),
                    m.primaryFailurePattern,
                  ])}
                />
              </div>
            </section>
          )}

          {/* Financial impact */}
          <section className="section">
            <h2 className="section__title">
              Preview: Financial Impact Estimate
            </h2>
            <div className="card">
              {packet.financialImpact.proposedAnnualIncrease == null ? (
                <>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.85rem",
                      marginBottom: "0.6rem",
                    }}
                  >
                    Enter the proposed renewal increase and covered employee
                    count above to see directional financial estimates.
                  </p>
                  {exposure != null && (
                    <p style={{ fontSize: "0.9rem" }}>
                      Productivity exposure sketch (at {String(coveredEmployees)} covered lives):{" "}
                      <strong>{fmtUsd(exposure)}/year</strong>{" "}
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                        — 10% BH prevalence × {fmtRate(agg.totals.ghostRate)} ghost rate × $4,783/untreated case
                      </span>
                    </p>
                  )}
                  <ul style={{ margin: "0.6rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
                    {packet.financialImpact.nonMonetaryConcessions.map((c) => (
                      <li key={c} style={{ marginBottom: "0.3rem" }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <PreviewTable
                    headers={["Financial Measure", "Estimated Value"]}
                    rows={[
                      [
                        "Proposed annual renewal increase",
                        fmtUsd(packet.financialImpact.proposedAnnualIncrease),
                      ],
                      [
                        "Estimated cost per covered employee",
                        packet.financialImpact.costPerCoveredEmployee != null
                          ? fmtUsd(packet.financialImpact.costPerCoveredEmployee)
                          : "Enter headcount to calculate",
                      ],
                      [
                        "Estimated affected employee population",
                        packet.financialImpact.estimatedAffectedPopulation != null
                          ? `~${packet.financialImpact.estimatedAffectedPopulation.toLocaleString("en-US")} employees`
                          : "Enter headcount to calculate",
                      ],
                      [
                        "Conservative concession target (10–25%)",
                        packet.financialImpact.conservativeConcessionTarget != null
                          ? `~${fmtUsd(packet.financialImpact.conservativeConcessionTarget)} – ${fmtUsd(Math.round(packet.financialImpact.conservativeConcessionTarget * 1.67))}`
                          : "—",
                      ],
                      [
                        "Aggressive concession target (25–50%)",
                        packet.financialImpact.aggressiveConcessionTarget != null
                          ? `~${fmtUsd(packet.financialImpact.aggressiveConcessionTarget)} – ${fmtUsd(Math.round(packet.financialImpact.aggressiveConcessionTarget * 1.43))}`
                          : "—",
                      ],
                    ]}
                  />
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      marginTop: "0.5rem",
                    }}
                  >
                    All figures are directional estimates. Affected population =
                    covered employees × 10% BH prevalence × verified ghost
                    rate. Review with benefits counsel before use.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Final position */}
          <section className="section">
            <h2 className="section__title">
              Preview: Final Renewal Position
            </h2>
            <div className="card">
              <p style={{ lineHeight: 1.7, maxWidth: "72ch" }}>
                Based on the verified ghost rate of{" "}
                <strong>{fmtRate(packet.summary.ghostRate)}</strong> and
                repeated access failures across{" "}
                {packet.summary.marketsAffected} employee market(s),{" "}
                <strong>{employerName.trim() || "[Employer]"}</strong> should
                not accept the proposed {renewalYear} renewal terms from{" "}
                <strong>{carrierName.trim() || "[Carrier]"}</strong> without:
                (1) a written network remediation commitment with target
                completion dates, (2) measurable access reporting on a
                quarterly basis, and (3) either financial concessions
                reflecting the network&apos;s underperformance or temporary
                out-of-network reimbursement accommodations for employees who
                cannot access listed behavioral health providers.
              </p>
            </div>
          </section>

          {/* Provider evidence appendix preview */}
          {packet.providerEvidence.length > 0 && (
            <section className="section">
              <h2 className="section__title">
                Preview: Provider Evidence Appendix{" "}
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 400,
                    color: "var(--muted)",
                  }}
                >
                  (first 10 shown; up to 60 included in PDF)
                </span>
              </h2>
              <div className="card">
                <PreviewTable
                  headers={[
                    "Provider",
                    "Result",
                    "Failure Reason",
                    "ZIP",
                    "Date",
                    "Evidence Type",
                    "Confidence",
                  ]}
                  rows={packet.providerEvidence.slice(0, 10).map((p) => [
                    p.providerName,
                    p.auditResult,
                    p.failureReason,
                    p.zipCode,
                    p.callTimestamp,
                    p.evidenceType,
                    p.confidenceLevel,
                  ])}
                />
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Bottom generate bar ───────────────────────────────────────────── */}
      <section className="section">
        <div className="card">
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--muted)",
              marginBottom: "0.8rem",
            }}
          >
            The PDF includes all sections above plus parity and compliance risk
            framing, recommended contract language, and the full provider
            evidence appendix. Review with ERISA counsel before bringing to a
            carrier renewal meeting.
          </p>
          <div className="packet-actions">
            <button
              type="button"
              className="btn"
              onClick={handleGeneratePdf}
              disabled={!hasData}
              title={
                !hasData
                  ? "Run a batch audit first to generate the packet."
                  : undefined
              }
            >
              Generate Renewal Packet (PDF)
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={handleCsv}
              disabled={!hasData}
            >
              Export evidence (CSV)
            </button>
            <Link to="/app/employer" className="btn secondary">
              Back to workspace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
