import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { apiGet, downloadPdf } from "../api";

export default function Results() {
  const { auditId } = useParams();
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (!cancelled) {
          setSummary(s);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auditId]);

  async function copyShare() {
    if (!auditId) return;
    const url = `${window.location.origin}/results/${auditId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function grabSummaryPdf() {
    if (!auditId) return;
    await downloadPdf(`/api/download/summary/${auditId}`, `gnb-audit-${auditId.slice(0, 8)}.pdf`);
  }

  async function grabComplaintPdf() {
    if (!auditId) return;
    await downloadPdf(
      `/api/download/complaint/${auditId}`,
      `gnb-complaint-${auditId.slice(0, 8)}.pdf`,
    );
  }

  if (!auditId) return <p className="err">Missing audit id.</p>;
  if (err) return <p className="err">{err}</p>;
  if (!summary) return <p className="lede">Loading results…</p>;

  const ghostPct = Math.round(summary.ghost_rate * 1000) / 10;

  return (
    <div>
      <h1>Your verified providers</h1>
      <p className="lede">
        {summary.carrier} · ZIP {summary.zip_code}
        {summary.care_needs.length ? ` · ${summary.care_needs.join(", ")}` : ""}
      </p>
      <div className="kpi-row">
        <div className="kpi">
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.real_count}</div>
          <div className="lbl">Real / usable</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.voicemail_count}</div>
          <div className="lbl">Voicemail</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.calls_completed}</div>
          <div className="lbl">Calls</div>
        </div>
      </div>

      {summary.loop_agent_note ? (
        <div className="banner" style={{ marginBottom: "1rem", color: "var(--text)" }}>
          <strong>Pipeline note:</strong> {summary.loop_agent_note}
        </div>
      ) : null}

      {summary.rag_hits && summary.rag_hits.length > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2>RAG — regulatory excerpts (demo retrieval)</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {summary.rag_hits.map((h) => (
              <li key={h.source}>
                <span className="mono" style={{ fontSize: "0.75rem" }}>
                  {h.source}
                </span>{" "}
                (score {h.score}) — {h.excerpt.slice(0, 200)}…
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Deliverables</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn secondary" onClick={() => void copyShare()}>
            {copied ? "Copied link" : "Copy shareable results link"}
          </button>
          <button type="button" className="btn secondary" onClick={() => void grabSummaryPdf()}>
            Download audit summary (PDF)
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!summary.complaint_eligible}
            title={
              summary.complaint_eligible
                ? "Draft complaint PDF"
                : "Unlocks when ghost rate is at least 70%"
            }
            onClick={() => void grabComplaintPdf()}
          >
            Download complaint draft (PDF)
          </button>
        </div>
        <p className="lede" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          <strong>Email summary:</strong> not wired in MVP — the field on the landing page is
          reserved for a future Resend/Postmark flow.
        </p>
      </div>

      <h2>Top matches</h2>
      <div className="grid" style={{ marginBottom: "1.5rem" }}>
        {summary.top_providers.map((p: CallResult) => (
          <div key={p.npi} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong>{p.provider_name || p.npi}</strong>
              <span className="pill real">verified</span>
            </div>
            <p className="caption">
              {p.specialty ? `${p.specialty} · ` : ""}
              {p.phone}
            </p>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>{p.summary}</p>
            <p style={{ margin: "0.25rem 0", fontSize: "0.78rem", color: "var(--muted)" }}>
              Verified at {p.verified_at || "n/a"}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--warn)" }}>
              {p.audio_note}
            </p>
            <button type="button" className="btn secondary" onClick={() => setOpen(open === p.npi ? null : p.npi)}>
              {open === p.npi ? "Hide transcript" : "View transcript"}
            </button>
            {open === p.npi ? <pre className="mono">{p.transcript}</pre> : null}
          </div>
        ))}
        {summary.top_providers.length === 0 ? (
          <p className="lede">No &quot;real&quot; providers in this sample run.</p>
        ) : null}
      </div>

      <h2>All calls</h2>
      <div className="tile-grid">
        {summary.results.map((t) => (
          <div
            key={`${t.npi}-${t.status}-${t.verified_at}`}
            className={`tile ${t.status === "real" ? "real" : t.status === "ghost" ? "ghost" : "voicemail"}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <span className="name">{t.provider_name || t.npi}</span>
              <span className={`pill ${t.status === "real" ? "real" : t.status === "ghost" ? "ghost" : "voicemail"}`}>
                {t.status}
              </span>
            </div>
            <div className="meta">{t.summary}</div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: "2rem" }}>
        <Link to="/">← New audit</Link>
      </p>
    </div>
  );
}
