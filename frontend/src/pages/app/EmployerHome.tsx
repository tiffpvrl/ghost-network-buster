import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  estimateExposureUsd,
  flatEvidenceRows,
  loadEmployerAggregates,
  type EmployerAggregates,
} from "../../data/employerAggregates";
import { listByCreatedAt, type EmployerBatch } from "../../data/employerBatches";
import { downloadFindingsMemo } from "../../lib/renewalReport";
import { downloadExecutiveSummary } from "../../lib/executiveSummary";
import { downloadEvidenceCsv } from "../../lib/evidenceCsv";
import { useLocale } from "../../locale";

const DEFAULT_HEADCOUNT = 500;

const PACKET_TOC = [
  "Executive summary",
  "Negotiation asks",
  "Market evidence",
  "Financial concession targets",
  "Recommended contract language",
  "Provider evidence appendix",
];

/* ── Inline icon helpers ───────────────────────────────────────────────── */
function SvgIcon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IconLayers() {
  return <SvgIcon><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></SvgIcon>;
}
function IconNetwork() {
  return <SvgIcon><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="6.5" y1="6.5" x2="9.5" y2="9.5"/><line x1="14.5" y1="9.5" x2="17.5" y2="6.5"/><line x1="6.5" y1="17.5" x2="9.5" y2="14.5"/><line x1="14.5" y1="14.5" x2="17.5" y2="17.5"/></SvgIcon>;
}
function IconChart() {
  return <SvgIcon><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></SvgIcon>;
}
function IconHospital() {
  return <SvgIcon><path d="M12 2v6M9 5h6"/><path d="M3 22h18"/><rect x="6" y="8" width="12" height="14"/><path d="M10 14h4M12 12v4"/></SvgIcon>;
}
function IconPlay() {
  return <SvgIcon><polygon points="5 3 19 12 5 21 5 3"/></SvgIcon>;
}
function IconDoc() {
  return <SvgIcon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></SvgIcon>;
}
function IconBriefcase() {
  return <SvgIcon><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></SvgIcon>;
}
function IconSparkles() {
  return <SvgIcon><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4z"/></SvgIcon>;
}
function IconExternal() {
  return <SvgIcon><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></SvgIcon>;
}
function IconArrowRight() {
  return <SvgIcon size={12}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></SvgIcon>;
}
function IconDownload() {
  return <SvgIcon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><line x1="12" y1="15" x2="12" y2="3"/></SvgIcon>;
}

/* ── Matrix visualization (decorative) ────────────────────────────────── */
const MATRIX_PATTERN = [
  [3, 4, 2, 1, 0, 1, 2],
  [4, 3, 4, 2, 1, 0, 1],
  [2, 4, 3, 4, 2, 1, 0],
  [1, 2, 4, 3, 4, 2, 1],
  [0, 1, 2, 4, 3, 4, 2],
];
function MatrixViz() {
  return (
    <div className="matrix-viz">
      <div className="matrix-wrap">
        <div className="matrix-y-axis">
          <span>11201</span>
          <span>10001</span>
          <span>10027</span>
          <span>10025</span>
          <span>11215</span>
        </div>
        <div className="matrix-grid">
          {MATRIX_PATTERN.flatMap((row, r) =>
            row.map((lvl, c) => (
              <div
                key={`${r}-${c}`}
                className={`matrix-cell l${lvl}`}
                style={{ animationDelay: `${(r + c) * 160}ms` }}
              />
            ))
          )}
        </div>
        <div className="matrix-x-axis">
          <span>Aetna</span>
          <span>Cigna</span>
          <span>Oscar</span>
          <span>Fidelis</span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function carrierInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ghostSeverity(rate: number): "severe" | "high" | "moderate" {
  if (rate >= 0.70) return "severe";
  if (rate >= 0.60) return "high";
  return "moderate";
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function EmployerHome() {
  const { t } = useLocale();
  const { employerTier } = useAuth();
  const [recent] = useState<EmployerBatch[]>(() => listByCreatedAt().slice(0, 3));
  const [headcount, setHeadcount] = useState<number>(DEFAULT_HEADCOUNT);
  const [agg, setAgg] = useState<EmployerAggregates>(() => loadEmployerAggregates());
  const [orgName, setOrgName] = useState<string>("");
  const [benefitsLead, setBenefitsLead] = useState<string>("");

  // Poll aggregates while any batch is running
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const next = loadEmployerAggregates();
      setAgg(next);
      const interval = next.totals.auditsRunning > 0 ? 2000 : 8000;
      window.setTimeout(tick, interval);
    };
    const id = window.setTimeout(tick, 2000);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, []);

  const exposure = useMemo(() => estimateExposureUsd(agg, headcount), [agg, headcount]);
  const hasData = agg.totals.audits > 0;
  const disabledTitle = hasData ? undefined : t("employerPacketDisabledTitle");

  function onHeadcountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    const val = raw === "" ? 0 : Math.min(1_000_000, parseInt(raw, 10));
    setHeadcount(val);
  }

  function handleMemo() { if (hasData) downloadFindingsMemo(agg, { headcount, orgName: orgName.trim() || undefined, benefitsLead: benefitsLead.trim() || undefined }); }
  function handleExec() { if (hasData) downloadExecutiveSummary(agg, { headcount, orgName: orgName.trim() || undefined }); }
  function handleCsv()  { if (hasData) downloadEvidenceCsv(flatEvidenceRows()); }

  const ghostPctDisplay = (agg.totals.ghostRate * 100).toFixed(1);

  return (
    <div className="employer-home">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="beacon-page-header">
        <div>
          <div className="page-eyebrow">
            <span className="meta-chip">Employer workspace</span>
            {employerTier && (
              <span className="meta-chip">{employerTier}</span>
            )}
          </div>
          <h1>Network health, <span className="serif">measured.</span></h1>
          <p className="lede" style={{ maxWidth: "64ch", marginBottom: 0 }}>
            Audit one or more carriers across multiple ZIPs in a single batch. Results aggregate
            into compliance-ready KPIs you can hand directly to your benefits committee or carrier rep.
          </p>
        </div>
        <div className="beacon-page-actions">
          <Link to="/app/patient" className="b-btn secondary">
            <IconExternal /> Open patient view
          </Link>
          <Link to="/app/employer/audits/new" className="b-btn accent lg">
            <IconPlay /> Run a new audit
          </Link>
        </div>
      </div>

      {/* ── Hero card ────────────────────────────────────────────────── */}
      <div className="hero-card">
        <div className="hero-card-inner">
          <div className="hero-card-content">
            <div className="ck-eyebrow"><IconLayers /> Batch audit</div>
            <h2>Run an <span className="serif">employer batch audit</span></h2>
            <p>
              Audit one or more carriers across multiple ZIPs in a single batch. Beacon dials every
              provider in the selected directories, captures call outcomes, and rolls everything into
              a compliance-ready report you can drop into a carrier renewal or HR memo.
            </p>
            <div className="hc-actions">
              <Link to="/app/employer/audits/new" className="b-btn accent lg">
                <IconPlay /> Run a new audit
              </Link>
              <Link to="/app/employer/packet" className="b-btn secondary">
                <IconDoc /> See a sample report
              </Link>
            </div>
          </div>
          <div className="hero-card-visual">
            <MatrixViz />
          </div>
        </div>
      </div>

      {/* ── Recent batches + Ghost rate by carrier ───────────────────── */}
      <div className="row-2col">

        {/* Recent batches */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="ph-title"><IconLayers /> Recent batches</div>
              <div className="ph-desc">Your last batch runs across this workspace</div>
            </div>
            <Link to="/app/employer/audits/new" className="b-btn sm secondary">View all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="eh-empty">
              No batches yet. <Link to="/app/employer/audits/new">Run your first audit →</Link>
            </div>
          ) : (
            <div className="eh-batch-list">
              {recent.map((b) => (
                <Link key={b.id} to={`/app/employer/batches/${b.id}`} className="eh-batch-item">
                  <div className="eh-batch-icon"><IconLayers /></div>
                  <div className="eh-batch-body">
                    <div className="eh-batch-id">{b.id.slice(0, 8)}</div>
                    <div className="eh-batch-meta">
                      {b.carriers.length} carrier × {b.zips.length} ZIP
                      <span className="sep">·</span>
                      {b.audits.length} audits
                    </div>
                  </div>
                  <div className="eh-batch-time">
                    {new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className={`eh-batch-status ${b.status}`}>
                    <span className="sdot" /> {b.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Ghost rate by carrier */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="ph-title"><IconNetwork /> Ghost rate by carrier</div>
              <div className="ph-desc">Aggregated across all batches · sorted highest to lowest</div>
            </div>
          </div>
          {!hasData ? (
            <div className="eh-empty">
              No audit data yet. <Link to="/app/employer/audits/new">Run a batch →</Link>
            </div>
          ) : (
            <div>
              {agg.byCarrier.map((row) => {
                const pct = Math.round(row.ghostRate * 100);
                const sev = ghostSeverity(row.ghostRate);
                return (
                  <div key={row.carrier} className="carrier-row">
                    <div className="carrier-logo">{carrierInitials(row.carrier)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="carrier-name">{row.carrier}</div>
                      <div className="carrier-sub">{row.audits} audit{row.audits !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="carrier-bar">
                      <div className={`carrier-bar-fill ${sev}`} style={{ width: pct + "%" }} />
                    </div>
                    <div className={`carrier-pct ${sev !== "moderate" ? sev : ""}`}>{pct}%</div>
                    <div className="carrier-count">{row.audits}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Financial exposure + Coverage gaps by ZIP ─────────────────── */}
      <div className="row-2col">

        {/* Financial exposure */}
        <div className="exposure-card">
          <div className="panel-head ec-panel-head">
            <div>
              <div className="ph-title">
                <IconChart /> Financial exposure
                <span className="sketch-pill">sketch</span>
              </div>
              <div className="ph-desc">Order-of-magnitude planning anchor only. Counsel will redline.</div>
            </div>
          </div>
          <div className="formula-label">
            Headcount × 10% baseline behavioral-health prevalence × weighted ghost rate × $4,783/year per untreated case.
            <br />
            <span className="formula-chip">HC × 0.10 × {ghostPctDisplay}% × $4,783</span>
          </div>
          <div className="exposure-input-row">
            <div className="exposure-field">
              <label>Headcount</label>
              <input
                type="text"
                value={headcount.toLocaleString()}
                onChange={onHeadcountChange}
                inputMode="numeric"
                aria-label="Headcount"
              />
            </div>
            <div className="exposure-output">
              <div className="big-num">{formatUsd(exposure)}</div>
              <div className="big-lbl">Illustrative annual exposure</div>
            </div>
          </div>
        </div>

        {/* Coverage gaps by ZIP */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="ph-title"><IconHospital /> Coverage gaps by ZIP</div>
              <div className="ph-desc">Reachable vs ghost providers across audited ZIPs</div>
            </div>
          </div>
          {agg.byZip.length === 0 ? (
            <div className="eh-empty">No ZIP data yet.</div>
          ) : (
            <div>
              {agg.byZip.slice(0, 5).map((z) => {
                const total = z.realCount + z.ghostCount;
                const realPct = total > 0 ? (z.realCount / total) * 100 : 0;
                const ghostPct = total > 0 ? (z.ghostCount / total) * 100 : 0;
                return (
                  <div key={z.zip} className="zip-row">
                    <div>
                      <div className="zip-code-label">ZIP {z.zip}</div>
                    </div>
                    <div>
                      <div className="zip-stack-bar">
                        <div className="zs-real" style={{ width: realPct + "%" }} />
                        <div className="zs-ghost" style={{ width: ghostPct + "%" }} />
                      </div>
                      <div className="zip-breakdown">
                        <span className="b-real">{z.realCount} real</span>
                        <span className="b-meta">·</span>
                        <span className="b-ghost">{z.ghostCount} ghost</span>
                        <span className="b-meta">·</span>
                        <span className="b-meta">{z.audits} audit{z.audits !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="zip-pct">{Math.round(ghostPct)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Negotiation packet ───────────────────────────────────────── */}
      <div className="eh-section-heading">
        <div>
          <h2>Negotiation packet</h2>
          <div className="sub">A polished, HR-facing carrier renewal artifact built from this workspace's evidence</div>
        </div>
      </div>

      <div className="packet-card">
        <div className="packet-card-inner">
          <div>
            <div className="pk-eyebrow">
              <span className="pk-pill">New</span>
              Auto-generated · ready in ~90 seconds
            </div>
            <h2>Walk into renewal with the <span className="serif">receipts</span>.</h2>
            <p>
              Generate a professional, HR-facing Carrier Renewal Negotiation Packet — executive summary,
              negotiation asks, market evidence, financial concession targets, recommended contract language,
              and a provider evidence appendix. All sourced from your batch audits and ready to redline.
            </p>
            <div className="pk-actions">
              <Link to="/app/employer/packet" className="b-btn btn-light">
                <IconSparkles /> Build Renewal Packet <IconArrowRight />
              </Link>
              <Link to="/app/employer/packet" className="b-btn btn-outline">
                <IconDoc /> Preview last packet
              </Link>
            </div>
          </div>
          <div className="packet-toc">
            <div className="toc-title">What's inside</div>
            <ol>
              {PACKET_TOC.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        </div>
      </div>

      {/* ── Quick exports ────────────────────────────────────────────── */}
      <div className="eh-section-heading">
        <div>
          <h2>Quick exports</h2>
          <div className="sub">Used in the memorandum header and signature block. Counsel will redline; placeholders are fine.</div>
        </div>
      </div>

      <div className="panel">
        <div className="exports-grid">
          <div className="exports-form">
            <div className="ef-field">
              <label>Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("employerReportContextOrgPlaceholder")}
                maxLength={120}
              />
            </div>
            <div className="ef-field">
              <label>Benefits lead</label>
              <input
                type="text"
                value={benefitsLead}
                onChange={(e) => setBenefitsLead(e.target.value)}
                placeholder={t("employerReportContextLeadPlaceholder")}
                maxLength={120}
              />
            </div>
          </div>

          <div className="exports-list">
            <div
              className="export-item"
              role="button"
              aria-disabled={!hasData}
              title={disabledTitle}
              onClick={handleMemo}
              style={{ cursor: hasData ? "pointer" : "not-allowed", opacity: hasData ? 1 : 0.4 }}
            >
              <div className="export-icon"><IconDoc /></div>
              <div>
                <div className="export-name">Findings memo</div>
                <div className="export-desc">14-page narrative summary with carrier breakdowns and remediation steps</div>
              </div>
              <span className="export-fmt">PDF</span>
            </div>

            <div
              className="export-item"
              role="button"
              aria-disabled={!hasData}
              title={disabledTitle}
              onClick={handleExec}
              style={{ cursor: hasData ? "pointer" : "not-allowed", opacity: hasData ? 1 : 0.4 }}
            >
              <div className="export-icon"><IconBriefcase /></div>
              <div>
                <div className="export-name">Executive summary</div>
                <div className="export-desc">2-page board-ready brief with KPIs, exposure, and recommended actions</div>
              </div>
              <span className="export-fmt">PDF</span>
            </div>

            <div
              className="export-item"
              role="button"
              aria-disabled={!hasData}
              title={disabledTitle}
              onClick={handleCsv}
              style={{ cursor: hasData ? "pointer" : "not-allowed", opacity: hasData ? 1 : 0.4 }}
            >
              <div className="export-icon csv"><IconDownload /></div>
              <div>
                <div className="export-name">Provider evidence</div>
                <div className="export-desc">Raw audit log: every call attempt, outcome, ghost reason, timestamp, and transcript ID</div>
              </div>
              <span className="export-fmt">CSV</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
