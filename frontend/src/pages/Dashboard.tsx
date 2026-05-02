import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { apiGet } from "../api";
import { playCallSound, playComplete } from "../audio";
import { DEMO_AUDIT_ID, DEMO_REPLAY_INTERVAL_MS, DEMO_SUMMARY } from "../demo-data";

const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";

function statusClass(s: CallResult["status"]): string {
  if (s === "real") return "real";
  if (s === "ghost") return "ghost";
  if (s === "voicemail") return "voicemail";
  return "pending";
}

function ghostReasonLabel(r?: string | null): string {
  const map: Record<string, string> = {
    disconnected: "Disconnected",
    wrong_network: "Wrong insurance",
    no_behavioral_health: "No BH services",
    not_accepting_patients: "Not accepting",
    wrong_provider: "Wrong number",
    retired: "Retired / moved",
    wrong_specialty: "Wrong specialty",
    referral_only: "Referral only",
  };
  return r ? (map[r] ?? r) : "";
}

function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: i % 3 === 0 ? "var(--ghost)" : i % 3 === 1 ? "var(--real)" : "var(--amber)",
      duration: `${1.8 + Math.random() * 1.4}s`,
      delay: `${Math.random() * 0.8}s`,
    }));
  }, []);
  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{ left: p.left, top: 0, background: p.color, animationDuration: p.duration, animationDelay: p.delay }}
        />
      ))}
    </>
  );
}

export default function Dashboard() {
  const { auditId } = useParams();
  const isDemo = auditId === DEMO_AUDIT_ID;
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const prevResults = useRef<Record<string, CallResult>>({});
  const startTime = useRef(Date.now());
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Elapsed timer
  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Demo replay mode — progressively reveal results at 3× speed, no API calls
  useEffect(() => {
    if (!isDemo) return;
    // Seed the backend so download endpoints work by the time replay finishes
    void fetch("/api/seed-demo", { method: "POST" }).catch(() => { /* offline is fine */ });
    const total = DEMO_SUMMARY.results.length;
    let idx = 0;
    let timerId: number;
    const tick = () => {
      const result = DEMO_SUMMARY.results[idx];
      // Play sound before revealing result
      playCallSound(result.status, result.ghost_reason);
      idx++;
      const slice = DEMO_SUMMARY.results.slice(0, idx);
      const ghostCount = slice.filter((r) => r.status === "ghost").length;
      const realCount = slice.filter((r) => r.status === "real").length;
      const isLast = idx >= total;
      setSummary({
        ...DEMO_SUMMARY,
        status: isLast ? "completed" : "running",
        calls_completed: idx,
        ghost_count: ghostCount,
        real_count: realCount,
        ghost_rate: ghostCount / idx,
        top_providers: slice.filter((r) => r.status === "real"),
        results: slice,
      });
      if (isLast) {
        // Small delay so the last result tone finishes before the arpeggio
        window.setTimeout(playComplete, 950);
      } else {
        timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
      }
    };
    timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
    return () => clearTimeout(timerId);
  }, [isDemo]);

  // WebSocket
  useEffect(() => {
    if (!auditId || isDemo) return;
    const qs = demoKey ? `?demo_key=${encodeURIComponent(demoKey)}` : "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const sock = new WebSocket(`${proto}://${window.location.host}/ws/audit/${auditId}${qs}`);
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; data?: AuditSummary };
        if (msg.type === "summary" && msg.data) setSummary(msg.data);
      } catch { /* ignore */ }
    };
    return () => sock.close();
  }, [auditId]);

  // Polling fallback
  useEffect(() => {
    if (!auditId || isDemo) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (cancelled) return;
        setSummary(s);
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Poll failed");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 600);
    return () => { cancelled = true; clearInterval(id); };
  }, [auditId]);

  // Flash animation on new results
  useEffect(() => {
    if (!summary) return;
    const newFlashes: Record<string, string> = {};
    for (const r of summary.results) {
      if (!prevResults.current[r.npi]) {
        newFlashes[r.npi] = r.status === "real" ? "flash-real" : r.status === "ghost" ? "flash-ghost" : "";
      }
    }
    if (Object.keys(newFlashes).length > 0) {
      setFlashMap((prev) => ({ ...prev, ...newFlashes }));
      setTimeout(() => {
        setFlashMap((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(newFlashes)) delete next[k];
          return next;
        });
      }, 700);
    }
    prevResults.current = Object.fromEntries(summary.results.map((r) => [r.npi, r]));
  }, [summary?.results]);

  // Auto-scroll transcript (only when not pinned to a selected provider)
  useEffect(() => {
    if (selectedNpi) return;
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [summary?.results.length, selectedNpi]);

  if (!auditId) return <p className="err">Missing audit id.</p>;

  const ghostPct = summary ? (summary.ghost_rate * 100).toFixed(1) : "0.0";
  const done = summary?.calls_completed ?? 0;
  const total = summary?.providers_total ?? 0;
  const doneAll = summary?.status === "completed";
  const ghostRate = summary?.ghost_rate ?? 0;
  const isHigh = ghostRate >= 0.7;
  const progress = total > 0 ? (done / total) * 100 : 0;

  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  // Ghost breakdown counts
  const breakdown = useMemo(() => {
    if (!summary) return [];
    const counts: Record<string, number> = {};
    for (const r of summary.results) {
      if (r.status === "ghost" && r.ghost_reason) {
        counts[r.ghost_reason] = (counts[r.ghost_reason] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  // Transcript display: after demo completes, clicking a tile pins it here
  const lastCall = summary?.results[summary.results.length - 1] ?? null;
  const pinnedCall = isDemo && doneAll && selectedNpi
    ? (summary?.results.find((r) => r.npi === selectedNpi) ?? lastCall)
    : null;
  const displayCall = pinnedCall ?? lastCall;

  // Whether tiles are clickable (demo post-completion only)
  const tilesClickable = isDemo && doneAll;

  return (
    <div>
      {doneAll && <Confetti />}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {!doneAll && <span className="dot-live" />}
          <span style={{ fontFamily: "var(--font-head)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            AUDITING {summary?.carrier ?? "…"} — {summary?.zip_code ?? "…"} — {doneAll ? "COMPLETE" : "LIVE"}
          </span>
          {isDemo && (
            <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", background: "var(--amber)", color: "#000", padding: "0.15rem 0.45rem", borderRadius: 2, letterSpacing: "0.1em" }}>
              DEMO
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          {elapsedStr}
        </span>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className={`kpi ghost-kpi${isHigh ? " glow" : ""}`}>
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate{!doneAll && done > 0 ? " ▲ climbing" : ""}</div>
        </div>
        <div className="kpi">
          <div className="val">{done}/{total}</div>
          <div className="lbl">Calls</div>
        </div>
        <div className="kpi ghost-kpi">
          <div className="val">{summary?.ghost_count ?? 0}</div>
          <div className="lbl">Ghosts</div>
        </div>
        <div className="kpi real-kpi">
          <div className="val">{summary?.real_count ?? 0}</div>
          <div className="lbl">Real</div>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Completion banner */}
      {doneAll && (
        <div className="completion-banner">
          <div className="cb-title">Audit Complete</div>
          <div className="cb-stat">{ghostPct}% of {summary?.carrier}'s listed providers in {summary?.zip_code} are GHOSTS</div>
          <p>We found {summary?.real_count} real providers. {summary?.top_providers.length} are accepting new patients.</p>
          <div className="cb-actions">
            <Link className="btn" to={`/results/${auditId}`}>View your providers</Link>
            {summary?.complaint_eligible && (
              <Link className="btn secondary" to={`/results/${auditId}`}>Generate complaint letter →</Link>
            )}
          </div>
        </div>
      )}

      {isHigh && !doneAll && (
        <div className="alert-bar">
          <span>⚠ Ghost rate exceeding 70% — complaint letter will be auto-generated on completion.</span>
        </div>
      )}

      {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}

      {/* 3-column layout */}
      <div className="dash-layout">

        {/* Col 1: Call tiles */}
        <div>
          <div className="col-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Directory — {total} providers</span>
            {tilesClickable && (
              <span style={{ fontSize: "0.6rem", color: "var(--muted)", fontStyle: "italic" }}>
                click to review
              </span>
            )}
          </div>
          <div className="tile-grid">
            {(summary?.results ?? []).map((t) => {
              const isSelected = selectedNpi === t.npi;
              return (
                <div
                  key={t.npi}
                  className={`tile ${statusClass(t.status)} ${flashMap[t.npi] ?? ""}`}
                  onClick={tilesClickable ? () => setSelectedNpi(isSelected ? null : t.npi) : undefined}
                  style={{
                    cursor: tilesClickable ? "pointer" : "default",
                    outline: isSelected ? "1.5px solid var(--amber)" : undefined,
                    boxShadow: isSelected ? "0 0 8px var(--amber)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <span className="name">{t.provider_name || t.npi}</span>
                    <span className={`pill ${statusClass(t.status)}`}>{t.status}</span>
                  </div>
                  {t.ghost_reason && <div className="meta">{ghostReasonLabel(t.ghost_reason)}</div>}
                  {t.summary && !t.ghost_reason && <div className="meta">{t.summary.slice(0, 60)}</div>}
                </div>
              );
            })}
            {(summary?.results.length ?? 0) === 0 && (
              <div className="tile pending">
                <span className="name">Initiating calls…</span>
                <div className="meta">Results appear as calls finish.</div>
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Live transcript */}
        <div>
          <div className="col-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {pinnedCall
                ? `Transcript — ${pinnedCall.provider_name ?? pinnedCall.npi}`
                : `Live call${lastCall ? ` — ${lastCall.provider_name ?? lastCall.npi}` : ""}`}
            </span>
            {pinnedCall && (
              <button
                type="button"
                onClick={() => setSelectedNpi(null)}
                style={{ fontSize: "0.6rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                × clear
              </button>
            )}
          </div>
          <div className="transcript-panel" ref={transcriptRef}>
            {displayCall ? (
              <>
                {displayCall.transcript.split("\n").map((line, i) => {
                  const isAgent = line.startsWith("Agent:");
                  const isProvider = line.startsWith("Provider:");
                  return (
                    <div key={i} className={isAgent ? "t-agent" : isProvider ? "t-provider" : "t-next"}>
                      {line}
                    </div>
                  );
                })}
                <div className={`t-result ${displayCall.status}`}>
                  RESULT: {displayCall.status.toUpperCase()}{displayCall.ghost_reason ? ` — ${ghostReasonLabel(displayCall.ghost_reason)}` : ""}
                </div>
                {!doneAll && <div className="t-next" style={{ marginTop: "0.5rem" }}>[NEXT CALL LOADING…]</div>}
              </>
            ) : (
              <div className="t-next">Waiting for first call to complete…</div>
            )}
          </div>
        </div>

        {/* Col 3: Real providers + breakdown */}
        <div>
          <div className="col-label">Confirmed real providers</div>
          {(summary?.top_providers ?? []).length === 0 ? (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Searching… {summary?.real_count ?? 0} found so far
            </div>
          ) : (
            (summary?.top_providers ?? []).map((p) => (
              <div key={p.npi} className="provider-card verified" style={{ marginBottom: "0.6rem" }}>
                <div className="verified-badge">✓ CONFIRMED REAL</div>
                <div style={{ fontFamily: "var(--font-head)", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {p.provider_name || p.npi}
                </div>
                {p.specialty && <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{p.specialty}</div>}
                {p.summary && <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.2rem" }}>{p.summary.slice(0, 80)}</div>}
              </div>
            ))
          )}

          {breakdown.length > 0 && (
            <>
              <div className="col-label" style={{ marginTop: "1.25rem" }}>Ghost breakdown</div>
              {breakdown.slice(0, 6).map(([reason, count]) => (
                <div key={reason} className="bar-row">
                  <div className="lbl">{ghostReasonLabel(reason)}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (count / Math.max(summary!.ghost_count, 1)) * 100)}%` }} />
                  </div>
                  <div className="count">{count}</div>
                </div>
              ))}
            </>
          )}

          {doneAll && (
            <Link
              className="btn full"
              to={`/results/${auditId}`}
              style={{ marginTop: "1rem", display: "flex" }}
            >
              View full results →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
