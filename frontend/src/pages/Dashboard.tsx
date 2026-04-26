import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { apiGet } from "../api";

const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";

function statusClass(s: CallResult["status"]): string {
  if (s === "real") return "real";
  if (s === "ghost") return "ghost";
  if (s === "voicemail") return "voicemail";
  return "pending";
}

export default function Dashboard() {
  const { auditId } = useParams();
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) return;
    const qs = demoKey ? `?demo_key=${encodeURIComponent(demoKey)}` : "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws/audit/${auditId}${qs}`;
    const sock = new WebSocket(wsUrl);
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; data?: AuditSummary };
        if (msg.type === "summary" && msg.data) setSummary(msg.data);
      } catch {
        /* ignore */
      }
    };
    return () => sock.close();
  }, [auditId]);

  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (cancelled) return;
        setSummary(s);
        setErr(null);
        if (s.status === "failed") {
          setErr("Audit failed on the server. Check API logs.");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Poll failed");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 450);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [auditId]);

  const tiles = useMemo(() => summary?.results ?? [], [summary]);

  if (!auditId) {
    return <p className="err">Missing audit id.</p>;
  }

  const ghostPct = summary ? Math.round(summary.ghost_rate * 1000) / 10 : 0;
  const done = summary?.calls_completed ?? 0;
  const total = summary?.providers_total ?? 0;
  const doneAll = summary?.status === "completed";

  return (
    <div>
      <h1>Live audit</h1>
      <p className="lede">
        Calls complete in completion order (parallel mock). Open results for PDFs and share link.
      </p>
      {doneAll ? (
        <div className="banner" style={{ borderColor: "var(--accent-dim)", color: "var(--text)" }}>
          <strong>Audit complete.</strong>{" "}
          <Link to={`/results/${auditId}`}>View results, top providers, and downloads →</Link>
        </div>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
      <div className="kpi-row">
        <div className="kpi">
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate (so far)</div>
        </div>
        <div className="kpi">
          <div className="val">
            {done}/{total}
          </div>
          <div className="lbl">Calls done</div>
        </div>
        <div className="kpi">
          <div className="val">{summary?.real_count ?? 0}</div>
          <div className="lbl">Real (usable)</div>
        </div>
        <div className="kpi">
          <div className="val">{summary?.voice_mode ?? "…"}</div>
          <div className="lbl">Voice mode</div>
        </div>
      </div>
      <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <Link className="btn secondary" to={`/results/${auditId}`}>
          Skip to results
        </Link>
      </div>
      <div className="tile-grid">
        {tiles.map((t) => (
          <div key={`${t.npi}-${t.verified_at}`} className={`tile ${statusClass(t.status)}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <span className="name">{t.provider_name || t.npi}</span>
              <span className={`pill ${statusClass(t.status)}`}>{t.status}</span>
            </div>
            <div className="meta">{t.phone}</div>
            {t.summary ? <div className="meta">{t.summary}</div> : null}
          </div>
        ))}
        {tiles.length === 0 ? (
          <div className="tile pending">
            <span className="name">Warming up…</span>
            <div className="meta">First transcripts appear as calls finish.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
