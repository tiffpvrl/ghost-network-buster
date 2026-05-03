import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { ApiError, apiGet } from "../api";
import { isSoundEnabled, playCallSound, playComplete, setSoundEnabled } from "../audio";
import StatusLegend from "../components/StatusLegend";
import AuditStepper from "../components/AuditStepper";
import { DEMO_AUDIT_ID, DEMO_REPLAY_INTERVAL_MS, DEMO_SUMMARY } from "../demo-data";
import { ghostReasonLabelShort } from "../labels";
import { useLocale } from "../locale";

const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";
const HIGH_GHOST_FRAC = 0.7;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function statusClass(s: CallResult["status"]): string {
  if (s === "real") return "real";
  if (s === "ghost") return "ghost";
  if (s === "voicemail") return "voicemail";
  return "pending";
}

function StatusGlyph({ status }: { status: CallResult["status"] }) {
  if (status === "real") {
    return (
      <svg className="status-glyph" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <title>Usable</title>
        <path d="M1 5.2 L4 8 L9 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "ghost") {
    return (
      <svg className="status-glyph" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <title>Ghost</title>
        <path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "voicemail") {
    return (
      <svg className="status-glyph" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <title>Voicemail</title>
        <rect x="1" y="3" width="8" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M4 8 v1.5 M6 8 v1.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg className="status-glyph" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <title>Pending</title>
      <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" />
    </svg>
  );
}

function Pill({ t }: { t: CallResult }) {
  return (
    <span className={`pill ${statusClass(t.status)}`} title={t.status}>
      <span className="pill-inner">
        <StatusGlyph status={t.status} />
        <span>{t.status}</span>
      </span>
    </span>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: i % 3 === 0 ? "var(--primary)" : i % 3 === 1 ? "var(--real)" : "var(--amber)",
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

type WsConnectState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export default function Dashboard() {
  const { t } = useLocale();
  const { auditId } = useParams();
  const isDemo = auditId === DEMO_AUDIT_ID;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WsConnectState>("idle");
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGhost, setFilterGhost] = useState<string>("all");
  const [search, setSearch] = useState("");
  const prevResults = useRef<Record<string, CallResult>>({});
  const startTime = useRef(Date.now());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    setSoundOn(next);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Demo replay mode — progressively reveal results at 3× speed, no API calls
  useEffect(() => {
    if (!isDemo) return;
    void fetch("/api/seed-demo", { method: "POST" }).catch(() => { /* offline is fine */ });
    const total = DEMO_SUMMARY.results.length;
    let idx = 0;
    let timerId: number;
    const tick = () => {
      const result = DEMO_SUMMARY.results[idx];
      playCallSound(result.status, result.ghost_reason);
      idx++;
      const slice = DEMO_SUMMARY.results.slice(0, idx);
      const ghostCount = slice.filter((r) => r.status === "ghost").length;
      const realCount = slice.filter((r) => r.status === "real").length;
      const rate = ghostCount / idx;
      const isLast = idx >= total;
      setSummary({
        ...DEMO_SUMMARY,
        status: isLast ? "completed" : "running",
        calls_completed: idx,
        ghost_count: ghostCount,
        real_count: realCount,
        ghost_rate: rate,
        high_ghost_rate: rate >= HIGH_GHOST_FRAC,
        top_providers: slice.filter((r) => r.status === "real"),
        results: slice,
      });
      if (isLast) {
        const celebrate = realCount > 0 && !prefersReducedMotion && isSoundEnabled();
        if (celebrate) window.setTimeout(playComplete, 950);
      } else {
        timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
      }
    };
    timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
    return () => clearTimeout(timerId);
  }, [isDemo, prefersReducedMotion]);

  // WebSocket + reconnect
  useEffect(() => {
    if (!auditId || isDemo) return;
    let cancelled = false;
    let sock: WebSocket | null = null;
    let attempt = 0;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const qs = demoKey ? `?demo_key=${encodeURIComponent(demoKey)}` : "";

    const connect = () => {
      if (cancelled) return;
      setWsState(attempt === 0 ? "connecting" : "reconnecting");
      const s = new WebSocket(`${proto}://${window.location.host}/ws/audit/${auditId}${qs}`);
      sock = s;
      s.onopen = () => {
        attempt = 0;
        setWsState("connected");
      };
      s.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string; data?: AuditSummary };
          if (msg.type === "summary" && msg.data) setSummary(msg.data);
        } catch { /* ignore */ }
      };
      s.onerror = () => {
        try {
          s.close();
        } catch { /* ignore */ }
      };
      s.onclose = () => {
        if (cancelled) return;
        setWsState("offline");
        attempt += 1;
        if (attempt <= 10) window.setTimeout(connect, Math.min(4000, 400 * attempt));
      };
    };

    connect();
    return () => {
      cancelled = true;
      try {
        sock?.close();
      } catch { /* ignore */ }
    };
  }, [auditId, isDemo]);

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
        if (!cancelled) {
          if (e instanceof ApiError) {
            if (e.status === 410) {
              setErr(`${t("linkExpiredTitle")} ${t("linkExpiredBody")}`);
            } else if (e.status === 401) {
              setErr(`${t("authErrorTitle")} ${t("authErrorBody")}`);
            } else {
              setErr(e.message);
            }
          } else {
            setErr(e instanceof Error ? e.message : "Poll failed");
          }
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 600);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auditId, isDemo, t]);

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

  // Live region: announce progress
  useEffect(() => {
    if (!summary || !announceRef.current) return;
    announceRef.current.textContent = `${summary.calls_completed} of ${summary.providers_total} calls completed.`;
  }, [summary?.calls_completed, summary?.providers_total]);

  // Auto-scroll transcript (only when not pinned to a selected provider)
  useEffect(() => {
    if (selectedNpi) return;
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [summary?.results.length, selectedNpi]);

  const ghostPct = summary ? (summary.ghost_rate * 100).toFixed(1) : "0.0";
  const done = summary?.calls_completed ?? 0;
  const total = summary?.providers_total ?? 0;
  const doneAll = summary?.status === "completed";
  const failed = summary?.status === "failed";
  const highGhost = summary?.high_ghost_rate ?? false;
  const progress = total > 0 ? (done / total) * 100 : 0;

  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  const etaSeconds = useMemo(() => {
    if (!summary || doneAll || failed || done === 0 || total <= done) return null;
    const started = summary.started_at ? Date.parse(summary.started_at) : NaN;
    if (!Number.isNaN(started)) {
      const elapsedSec = Math.max(1, (Date.now() - started) / 1000);
      const rate = done / elapsedSec;
      if (rate > 0.01) return Math.round((total - done) / rate);
    }
    const e = Math.max(1, elapsed);
    return Math.round((e / done) * (total - done));
  }, [summary, done, total, doneAll, failed, elapsed]);

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

  const filteredTiles = useMemo(() => {
    if (!summary) return [];
    const q = search.trim().toLowerCase();
    return summary.results.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterGhost !== "all" && (t.ghost_reason ?? "") !== filterGhost) return false;
      if (q) {
        const hay = `${t.provider_name ?? ""} ${t.npi}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [summary, filterStatus, filterGhost, search]);

  const lastCall = summary?.results[summary.results.length - 1] ?? null;
  const pinnedCall = doneAll && selectedNpi
    ? (summary?.results.find((r) => r.npi === selectedNpi) ?? lastCall)
    : null;
  const displayCall = pinnedCall ?? lastCall;

  const tilesClickable = (doneAll || failed) && (summary?.results.length ?? 0) > 0;
  const celebrateEnv = import.meta.env.VITE_CELEBRATE_COMPLETION === "true";
  const showConfetti =
    doneAll &&
    !failed &&
    (summary?.real_count ?? 0) > 0 &&
    !prefersReducedMotion &&
    (isDemo || celebrateEnv);

  const ghostReasonsInResults = useMemo(() => {
    const s = new Set<string>();
    (summary?.results ?? []).forEach((r) => {
      if (r.ghost_reason) s.add(r.ghost_reason);
    });
    return Array.from(s).sort();
  }, [summary?.results]);

  if (!auditId) return <p className="err">{t("dashboardMissingAudit")}</p>;

  return (
    <div className="dashboard-root">
      <div ref={announceRef} className="sr-only" aria-live="polite" />
      {showConfetti ? <Confetti /> : null}

      {failed && summary ? (
        <div className="failed-banner" style={{ border: "1px solid var(--ghost)", borderRadius: 4, padding: "1.25rem", marginBottom: "1.25rem", background: "var(--ghost-dim)" }}>
          <h2 style={{ fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ghost)", marginBottom: "0.5rem" }}>
            Audit failed
          </h2>
          <p className="lede" style={{ color: "var(--text)", marginBottom: "0.75rem" }}>
            {summary.error || "The audit stopped due to an error. Partial results may still be useful below."}
          </p>
          <Link className="btn secondary" to="/app/patient">Start over</Link>
        </div>
      ) : null}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {!doneAll && !failed && <span className="dot-live" aria-hidden />}
          <span style={{ fontFamily: "var(--font-head)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            AUDITING {summary?.carrier ?? "…"} — {summary?.zip_code ?? "…"} — {doneAll ? "COMPLETE" : failed ? "FAILED" : "LIVE"}
          </span>
          {isDemo && (
            <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", background: "var(--amber)", color: "#000", padding: "0.15rem 0.45rem", borderRadius: 2, letterSpacing: "0.1em" }}>
              DEMO
            </span>
          )}
          {!isDemo && wsState !== "idle" && (
            <span className="ws-status" style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
              {wsState === "connected" ? "" : wsState === "connecting" ? "· connecting" : wsState === "reconnecting" ? "· reconnecting…" : "· live updates offline (polling)"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {!isDemo && (
            <button type="button" className="btn-sound" onClick={toggleSound} aria-pressed={soundOn}>
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          )}
          <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{elapsedStr}</span>
        </div>
      </div>

      {!failed ? (
        <AuditStepper auditId={auditId} doneAll={doneAll} failed={failed} realCount={summary?.real_count ?? 0} />
      ) : null}

      {/* KPIs */}
      <div className="kpi-row">
        <div className={`kpi ghost-kpi${highGhost && !doneAll && done > 0 ? " glow" : ""}`}>
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate{!doneAll && done > 0 ? " (in progress)" : ""}</div>
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
        {etaSeconds != null && !doneAll ? (
          <div className="kpi">
            <div className="val" style={{ fontSize: "1.15rem" }}>~{etaSeconds}s</div>
            <div className="lbl">ETA (rough)</div>
          </div>
        ) : null}
      </div>

      {summary ? <StatusLegend /> : null}

      <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {!isDemo && !failed && !doneAll && wsState === "connecting" ? (
        <p className="print-hidden" style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "1rem" }}>
          {t("dashboardWsConnecting")}
        </p>
      ) : null}

      {/* Completion banner */}
      {doneAll && (
        <div className="completion-banner">
          <div className="cb-title">Audit Complete</div>
          <div className="cb-stat">{ghostPct}% of {summary?.carrier}&apos;s listed providers in {summary?.zip_code} failed verification as usable contacts</div>
          <p>We found {summary?.real_count} listings that passed as usable in this run. {summary?.top_providers.length} appear in the quick shortlist (accepting / in-network per reception).</p>
          <div className="cb-actions">
            <Link className="btn" to={`/app/patient/results/${auditId}`}>View your providers</Link>
            {summary?.complaint_eligible === true && (
              <Link className="btn secondary" to={`/app/patient/results/${auditId}`}>Generate complaint letter →</Link>
            )}
          </div>
        </div>
      )}

      {highGhost && summary?.complaint_eligible && !doneAll && !failed && (
        <div className="alert-bar">
          <span className="alert-icon" aria-hidden />
          <span>High ghost rate — a complaint draft may be available when the audit completes if at least one failed listing is confirmed.</span>
        </div>
      )}

      {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}

      {/* Filters */}
      {summary && summary.results.length > 0 && (
        <div className="dash-filters print-hidden" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem", alignItems: "flex-end" }}>
          <div>
            <label htmlFor="flt-status" className="filter-label">Status</label>
            <select id="flt-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All</option>
              <option value="real">real</option>
              <option value="ghost">ghost</option>
              <option value="voicemail">voicemail</option>
              <option value="no_answer">no_answer</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <label htmlFor="flt-ghost" className="filter-label">Ghost reason</label>
            <select id="flt-ghost" value={filterGhost} onChange={(e) => setFilterGhost(e.target.value)} className="filter-select">
              <option value="all">All</option>
              {ghostReasonsInResults.map((g) => (
                <option key={g} value={g}>{ghostReasonLabelShort(g)}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label htmlFor="flt-search" className="filter-label">Search name / NPI</label>
            <input id="flt-search" className="filter-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter…" />
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="dash-layout">

        {/* Col 1: Call tiles */}
        <div>
          <div className="col-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Directory — {total} providers</span>
            {tilesClickable && (
              <span style={{ fontSize: "0.65rem", color: "var(--muted)", fontStyle: "italic" }}>
                click tile to pin transcript
              </span>
            )}
          </div>
          <div className="tile-grid" role="list">
            {filteredTiles.map((t) => {
              const isSelected = selectedNpi === t.npi;
              const inner = (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <span className="name">{t.provider_name || t.npi}</span>
                    <Pill t={t} />
                  </div>
                  {t.ghost_reason && <div className="meta">{ghostReasonLabelShort(t.ghost_reason)}</div>}
                  {t.summary && !t.ghost_reason && <div className="meta">{t.summary.slice(0, 60)}</div>}
                </>
              );
              if (tilesClickable) {
                return (
                  <button
                    key={t.npi}
                    type="button"
                    className={`tile tile-btn ${statusClass(t.status)} ${flashMap[t.npi] ?? ""}`}
                    onClick={() => setSelectedNpi(isSelected ? null : t.npi)}
                    aria-pressed={isSelected}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      outline: isSelected ? "1.5px solid var(--primary)" : undefined,
                      boxShadow: isSelected ? "0 0 8px color-mix(in srgb, var(--primary) 45%, transparent)" : undefined,
                    }}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div key={t.npi} className={`tile ${statusClass(t.status)} ${flashMap[t.npi] ?? ""}`} role="listitem">
                  {inner}
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
                className="linkish"
                onClick={() => setSelectedNpi(null)}
                style={{ fontSize: "0.65rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                × clear pin
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
                  RESULT: {displayCall.status.toUpperCase()}{displayCall.ghost_reason ? ` — ${ghostReasonLabelShort(displayCall.ghost_reason)}` : ""}
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
          <div className="col-label">Confirmed usable listings</div>
          {(summary?.top_providers ?? []).length === 0 ? (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Searching… {summary?.real_count ?? 0} found so far
            </div>
          ) : (
            (summary?.top_providers ?? []).map((p) => (
              <div key={p.npi} className="provider-card verified" style={{ marginBottom: "0.6rem" }}>
                <div className="verified-badge">USABLE IN THIS RUN</div>
                <div style={{ fontFamily: "var(--font-head)", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {p.provider_name || p.npi}
                </div>
                {p.specialty && <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{p.specialty}</div>}
                {p.summary && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.2rem" }}>{p.summary.slice(0, 80)}</div>}
              </div>
            ))
          )}

          {breakdown.length > 0 && (
            <>
              <div className="col-label" style={{ marginTop: "1.25rem" }}>Ghost breakdown</div>
              {breakdown.slice(0, 6).map(([reason, count]) => (
                <div key={reason} className="bar-row">
                  <div className="lbl">{ghostReasonLabelShort(reason)}</div>
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
              to={`/app/patient/results/${auditId}`}
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
