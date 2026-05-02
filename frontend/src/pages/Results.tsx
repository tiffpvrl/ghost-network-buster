import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { apiGet, downloadPdf } from "../api";
import { DEMO_AUDIT_ID, DEMO_SUMMARY } from "../demo-data";

function ghostReasonLabel(r?: string | null): string {
  const map: Record<string, string> = {
    disconnected: "Disconnected number",
    wrong_network: "Wrong insurance",
    no_behavioral_health: "No BH services",
    not_accepting_patients: "Not accepting patients",
    wrong_provider: "Wrong number / person",
    retired: "Retired / moved",
    wrong_specialty: "Wrong specialty",
    referral_only: "Referral only",
  };
  return r ? (map[r] ?? r) : "";
}

export default function Results() {
  const { auditId } = useParams();
  const isDemo = auditId === DEMO_AUDIT_ID;
  const [summary, setSummary] = useState<AuditSummary | null>(isDemo ? DEMO_SUMMARY : null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId || isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (!cancelled) { setSummary(s); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => { cancelled = true; };
  }, [auditId, isDemo]);

  async function copyShare() {
    await navigator.clipboard.writeText(`${window.location.origin}/results/${auditId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function grab(path: string, filename: string, key: string) {
    setDownloading(key);
    try { await downloadPdf(path, filename); }
    finally { setDownloading(null); }
  }

  if (!auditId) return <p className="err">Missing audit id.</p>;
  if (err) return <p className="err">{err}</p>;
  if (!summary) return <p className="lede">Loading results…</p>;

  const ghostPct = (summary.ghost_rate * 100).toFixed(1);
  const isHigh = summary.ghost_rate >= 0.7;

  // Breakdown
  const breakdown: Record<string, number> = {};
  for (const r of summary.results) {
    if (r.status === "ghost" && r.ghost_reason) {
      breakdown[r.ghost_reason] = (breakdown[r.ghost_reason] ?? 0) + 1;
    }
  }
  const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Audit complete · {summary.carrier} · ZIP {summary.zip_code}
          {isDemo && (
            <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", background: "var(--amber)", color: "#000", padding: "0.15rem 0.45rem", borderRadius: 2, letterSpacing: "0.1em" }}>
              DEMO
            </span>
          )}
        </div>
        <h1>We found {summary.real_count} real therapist{summary.real_count !== 1 ? "s" : ""} — out of {summary.providers_total} listed.</h1>
        <p className="lede">
          Verified today via direct AI phone calls.{" "}
          {summary.care_needs.length ? `Care needs: ${summary.care_needs.join(", ")}.` : ""}
        </p>
      </div>

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: "1.5rem" }}>
        <div className="kpi ghost-kpi">
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate</div>
        </div>
        <div className="kpi real-kpi">
          <div className="val">{summary.real_count}</div>
          <div className="lbl">Real / usable</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.voicemail_count}</div>
          <div className="lbl">Voicemail</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.calls_completed}</div>
          <div className="lbl">Calls placed</div>
        </div>
      </div>

      {/* Complaint alert */}
      {isHigh && (
        <div className="alert-bar" style={{ marginBottom: "1.5rem" }}>
          <span>Your insurer's directory may violate federal law. {ghostPct}% ghost rate exceeds the threshold for NY DFS action.</span>
          {summary.complaint_eligible && (
            <button
              type="button"
              className="btn"
              style={{ flexShrink: 0, fontSize: "0.7rem" }}
              disabled={downloading === "complaint"}
              onClick={() => void grab(`/api/download/complaint/${auditId}`, `gnb-complaint-${auditId!.slice(0, 8)}.docx`, "complaint")}
            >
              {downloading === "complaint" ? "Generating…" : "Generate Complaint Letter →"}
            </button>
          )}
        </div>
      )}

      {/* Top providers */}
      <h2 style={{ marginBottom: "1rem" }}>Confirmed real providers</h2>
      {summary.top_providers.length === 0 ? (
        <p className="lede">No confirmed real providers in this audit.</p>
      ) : (
        summary.top_providers.map((p: CallResult) => (
          <div key={p.npi} className="provider-card verified">
            <div className="verified-badge">✓ VERIFIED REAL — Confirmed accepting {summary.carrier} today</div>
            <h3>{p.provider_name || p.npi}</h3>
            {p.specialty && <div className="detail">● Specialty: {p.specialty}</div>}
            <div className="detail highlight">● Accepts {summary.carrier} ✓</div>
            <div className="detail highlight">● Accepting new patients ✓</div>
            {p.summary && <div className="detail" style={{ marginTop: "0.5rem", fontStyle: "italic" }}>{p.summary}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" onClick={() => setOpen(open === p.npi ? null : p.npi)}>
                {open === p.npi ? "Hide transcript" : "View transcript"}
              </button>
            </div>
            {open === p.npi && <pre className="mono" style={{ marginTop: "0.65rem" }}>{p.transcript}</pre>}
          </div>
        ))
      )}

      {/* Downloads */}
      <div className="card" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <h2>Downloads & sharing</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn secondary" onClick={() => void copyShare()}>
            {copied ? "✓ Copied" : "Copy share link"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={downloading === "pdf"}
            onClick={() => void grab(`/api/download/summary/${auditId}`, `gnb-audit-${auditId!.slice(0, 8)}.pdf`, "pdf")}
          >
            {downloading === "pdf" ? "Downloading…" : "Download audit summary (PDF)"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!summary.complaint_eligible || downloading === "complaint"}
            title={summary.complaint_eligible ? "" : "Unlocks when ghost rate ≥ 70%"}
            onClick={() => void grab(`/api/download/complaint/${auditId}`, `gnb-complaint-${auditId!.slice(0, 8)}.docx`, "complaint")}
          >
            {downloading === "complaint" ? "Generating…" : "Download complaint draft"}
          </button>
        </div>
      </div>

      {/* Ghost breakdown */}
      {breakdownEntries.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2>Ghost breakdown</h2>
          {breakdownEntries.map(([reason, count]) => (
            <div key={reason} className="bar-row">
              <div className="lbl">{ghostReasonLabel(reason)}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, (count / Math.max(summary.ghost_count, 1)) * 100)}%` }} />
              </div>
              <div className="count">{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* All calls */}
      <h2 style={{ marginBottom: "0.75rem" }}>All calls</h2>
      <div className="tile-grid" style={{ marginBottom: "2rem" }}>
        {summary.results.map((t) => (
          <div
            key={`${t.npi}-${t.verified_at}`}
            className={`tile ${t.status === "real" ? "real" : t.status === "ghost" ? "ghost" : "voicemail"}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
              <span className="name">{t.provider_name || t.npi}</span>
              <span className={`pill ${t.status === "real" ? "real" : t.status === "ghost" ? "ghost" : "voicemail"}`}>
                {t.status}
              </span>
            </div>
            {t.ghost_reason && <div className="meta">{ghostReasonLabel(t.ghost_reason)}</div>}
            {t.summary && !t.ghost_reason && <div className="meta">{t.summary.slice(0, 55)}</div>}
          </div>
        ))}
      </div>

      <Link to="/" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>← New audit</Link>
    </div>
  );
}
