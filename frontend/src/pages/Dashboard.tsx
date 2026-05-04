import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type SVGProps } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { ApiError, apiGet } from "../api";
import { useAuth, type PatientAuditTierChoice } from "../auth/AuthProvider";
import { isSoundEnabled, playCallSound, playComplete, setSoundEnabled } from "../audio";
import AuditStepper from "../components/AuditStepper";
import { DEMO_AUDIT_ID, DEMO_REPLAY_INTERVAL_MS, DEMO_SUMMARY } from "../demo-data";
import { useLocale } from "../locale";

const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";
const HIGH_GHOST_FRAC = 0.7;

const TIER_GATE_KEY = (auditId: string) => `gnb_tier_gate_${auditId}`;

function readTierGateClosed(auditId: string | undefined, isDemoAudit: boolean): boolean {
  if (!auditId || isDemoAudit) return true;
  try {
    return window.sessionStorage.getItem(TIER_GATE_KEY(auditId)) === "1";
  } catch {
    return false;
  }
}

/* ── Icon helpers ────────────────────────────────────────────────────────── */
function SI({ d, sw = 1.75, children, ...p }: { d?: string; sw?: number; children?: ReactNode; [k: string]: unknown }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...(p as SVGProps<SVGSVGElement>)}>
      {d ? <path d={d} /> : children}
    </svg>
  );
}
const IcoAlert = (p: SVGProps<SVGSVGElement>) =><SI {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></SI>;
const IcoCheck = (p: SVGProps<SVGSVGElement>) => <SI {...p} d="M20 6L9 17l-5-5" />;
const IcoX = (p: SVGProps<SVGSVGElement>) => <SI {...p} d="M18 6L6 18M6 6l12 12" />;
const IcoDownload = (p: SVGProps<SVGSVGElement>) => <SI {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><line x1="12" y1="15" x2="12" y2="3"/></SI>;
const IcoSparkles = (p: SVGProps<SVGSVGElement>) => <SI {...p} d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4z" />;
const IcoChart = (p: SVGProps<SVGSVGElement>) => <SI {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></SI>;
const IcoArrowUp = (p: SVGProps<SVGSVGElement>) => <SI {...p}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></SI>;
const IcoArrowDown = (p: SVGProps<SVGSVGElement>) => <SI {...p}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></SI>;

/* ── Sparkline ───────────────────────────────────────────────────────────── */
function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  const id = useId();
  const w = 120, h = 28, pad = 2;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = path + ` L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const gid = `spark-${id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Ring (donut) ────────────────────────────────────────────────────────── */
function Ring({ pct, size = 124, stroke = 9, color = "var(--danger)" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  return (
    <div className="ring-wrap" style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray .7s ease" }} />
      </svg>
      <div className="ring-text">
        <div className="ring-pct">{pct}<span style={{ fontSize: "0.55em", color: "var(--muted)", fontWeight: 500 }}>%</span></div>
        <div className="ring-lbl">Ghosted</div>
      </div>
    </div>
  );
}

/* ── KPI card ────────────────────────────────────────────────────────────── */
function KPI({ label, icon, value, unit, trend, trendDir, foot, spark, sparkColor }: {
  label: string; icon: ReactNode; value: string | number; unit?: string;
  trend?: string; trendDir?: "bad" | "good"; foot?: ReactNode;
  spark?: number[]; sparkColor?: string;
}) {
  return (
    <div className="beacon-kpi">
      <div className="beacon-kpi-header">
        <div className="beacon-kpi-label">{icon}{label}</div>
        {trend && (
          <span className={`beacon-kpi-trend${trendDir ? " " + trendDir : ""}`}>
            {trendDir === "bad" ? <IcoArrowUp /> : trendDir === "good" ? <IcoArrowDown /> : null}
            {trend}
          </span>
        )}
      </div>
      <div className="beacon-kpi-value">{value}{unit && <span className="unit">{unit}</span>}</div>
      {foot && <div className="beacon-kpi-foot">{foot}</div>}
      {spark && spark.length >= 2 && (
        <div className="beacon-kpi-spark">
          <Sparkline data={spark} color={sparkColor ?? "var(--accent)"} />
        </div>
      )}
    </div>
  );
}

/* ── usePrefersReducedMotion ─────────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setR(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return r;
}

type WsState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

/* ── Dashboard ───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { t } = useLocale();
  const { auditId } = useParams();
  const isDemo = auditId === DEMO_AUDIT_ID;
  const { applyPatientAuditTierChoice } = useAuth();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [wsState, setWsState] = useState<WsState>("idle");
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [tierGateClosed, setTierGateClosed] = useState(() =>
    typeof window !== "undefined" ? readTierGateClosed(auditId, isDemo) : true,
  );

  const startTime = useRef(Date.now());
  const announceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTierGateClosed(readTierGateClosed(auditId, isDemo));
  }, [auditId, isDemo]);

  const commitTierChoice = useCallback(
    (choice: PatientAuditTierChoice) => {
      if (auditId && !isDemo) {
        applyPatientAuditTierChoice(auditId, choice);
        try {
          window.sessionStorage.setItem(TIER_GATE_KEY(auditId), "1");
        } catch {
          /* ignore */
        }
      }
      setTierGateClosed(true);
    },
    [auditId, isDemo, applyPatientAuditTierChoice],
  );

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

  // Demo replay
  useEffect(() => {
    if (!isDemo) return;
    void fetch("/api/seed-demo", { method: "POST" }).catch(() => { /* offline ok */ });
    const total = DEMO_SUMMARY.results.length;
    let idx = 0;
    let timerId: number;
    const tick = () => {
      const result = DEMO_SUMMARY.results[idx];
      playCallSound(result.status, result.ghost_reason);
      idx++;
      const slice = DEMO_SUMMARY.results.slice(0, idx);
      const ghostCount = slice.filter(r => r.status === "ghost").length;
      const realCount = slice.filter(r => r.status === "real").length;
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
        top_providers: slice.filter(r => r.status === "real"),
        results: slice,
      });
      if (isLast) {
        if (realCount > 0 && !prefersReducedMotion && isSoundEnabled()) window.setTimeout(playComplete, 950);
      } else {
        timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
      }
    };
    timerId = window.setTimeout(tick, DEMO_REPLAY_INTERVAL_MS);
    return () => clearTimeout(timerId);
  }, [isDemo, prefersReducedMotion]);

  // WebSocket
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
      s.onopen = () => { attempt = 0; setWsState("connected"); };
      s.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string; data?: AuditSummary };
          if (msg.type === "summary" && msg.data) setSummary(msg.data);
        } catch { /* ignore */ }
      };
      s.onerror = () => { try { s.close(); } catch { /* ignore */ } };
      s.onclose = () => {
        if (cancelled) return;
        setWsState("offline");
        attempt++;
        if (attempt <= 10) window.setTimeout(connect, Math.min(4000, 400 * attempt));
      };
    };
    connect();
    return () => { cancelled = true; try { sock?.close(); } catch { /* ignore */ } };
  }, [auditId, isDemo]);

  // Polling fallback
  useEffect(() => {
    if (!auditId || isDemo) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (!cancelled) { setSummary(s); setErr(null); }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) {
            if (e.status === 410) setErr(`${t("linkExpiredTitle")} ${t("linkExpiredBody")}`);
            else if (e.status === 401) setErr(`${t("authErrorTitle")} ${t("authErrorBody")}`);
            else setErr(e.message);
          } else setErr(e instanceof Error ? e.message : "Poll failed");
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 600);
    return () => { cancelled = true; clearInterval(id); };
  }, [auditId, isDemo, t]);

  // Live region
  useEffect(() => {
    if (summary && announceRef.current)
      announceRef.current.textContent = `${summary.calls_completed} of ${summary.providers_total} calls completed.`;
  }, [summary?.calls_completed, summary?.providers_total]);

  /* ── Derived values ── */
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
    return Math.round((Math.max(1, elapsed) / done) * (total - done));
  }, [summary, done, total, doneAll, failed, elapsed]);

  // Sparkline data (per-chip trends only)
  const sparks = useMemo(() => {
    const results: CallResult[] = summary?.results ?? [];
    const n = results.length;
    if (n < 2) return { rate: [] as number[], verified: [] as number[], ghosts: [] as number[], prog: [] as number[] };
    const pts = Math.min(8, n);
    const chunk = Math.ceil(n / pts);
    const rate: number[] = [], verified: number[] = [], ghosts: number[] = [], prog: number[] = [];
    for (let i = 1; i <= pts; i++) {
      const sl = results.slice(0, i * chunk);
      const g = sl.filter(r => r.status === "ghost").length;
      const r2 = sl.filter(r => r.status === "real").length;
      rate.push(sl.length ? (g / sl.length) * 100 : 0);
      verified.push(r2);
      ghosts.push(g);
      prog.push((sl.length / (summary?.providers_total ?? 1)) * 100);
    }
    return { rate, verified, ghosts, prog };
  }, [summary?.results?.length, summary?.providers_total]);

  if (!auditId) return <p className="err">{t("dashboardMissingAudit")}</p>;

  const showTierGate = auditId && !isDemo && !tierGateClosed;

  return (
    <div className="beacon-dashboard">
      <div ref={announceRef} className="sr-only" aria-live="polite" />
      {showTierGate ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tier-gate-title">
          <div className="modal-panel card" style={{ maxWidth: 920 }}>
            <p className="page-eyebrow" style={{ marginBottom: "0.5rem" }}>
              {t("auditTierGateTitle")}
            </p>
            <h2 id="tier-gate-title" style={{ marginBottom: "0.5rem", fontSize: "1.25rem" }}>
              {t("auditTierGateSubtitle")}
            </h2>
            <p className="lede" style={{ marginBottom: "1.25rem", fontSize: "0.85rem" }}>
              {t("paywallFinePrint")}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div className="card" style={{ marginBottom: 0, padding: "1rem" }}>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                  {t("auditTierFreeTitle")}
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0.35rem 0" }}>{t("auditTierFreePrice")}</div>
                <p className="lede" style={{ fontSize: "0.78rem", marginBottom: "1rem", minHeight: "4.5rem" }}>
                  {t("auditTierFreeBody")}
                </p>
                <button type="button" className="btn full secondary" onClick={() => commitTierChoice("free")}>
                  {t("auditTierFreeCta")}
                </button>
              </div>
              <div className="card" style={{ marginBottom: 0, padding: "1rem", borderColor: "var(--accent)" }}>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                  {t("auditTierShortlistTitle")}
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0.35rem 0" }}>{t("auditTierShortlistPrice")}</div>
                <p className="lede" style={{ fontSize: "0.78rem", marginBottom: "1rem", minHeight: "4.5rem" }}>
                  {t("auditTierShortlistBody")}
                </p>
                <button type="button" className="btn full" onClick={() => commitTierChoice("shortlist")}>
                  {t("auditTierShortlistCta")}
                </button>
              </div>
              <div className="card" style={{ marginBottom: 0, padding: "1rem" }}>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                  {t("auditTierFullTitle")}
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0.35rem 0" }}>{t("auditTierFullPrice")}</div>
                <p className="lede" style={{ fontSize: "0.78rem", marginBottom: "1rem", minHeight: "4.5rem" }}>
                  {t("auditTierFullBody")}
                </p>
                <button type="button" className="btn full secondary" onClick={() => commitTierChoice("full")}>
                  {t("auditTierFullCta")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* ── Page header ── */}
      <div className="beacon-page-header">
        <div>
          <div className="page-eyebrow">
            Network audit · {summary?.carrier ?? "…"}
            {isDemo && <span className="demo-badge">DEMO</span>}
            {!isDemo && wsState === "offline" && <span style={{ color: "var(--warning)", marginLeft: "0.4rem" }}>· polling</span>}
          </div>
          <h1>Directory <span className="serif">accuracy report</span></h1>
          <div className="page-meta-row">
            {failed
              ? <span className="meta-chip danger">Failed</span>
              : doneAll
              ? <span className="meta-chip"><IcoCheck style={{ width: 11, height: 11 }} /> Completed</span>
              : <span className="meta-chip live">Audit in progress</span>}
            <span className="meta-chip"><span className="k">Region</span> {summary?.zip_code ?? "…"}</span>
            {summary?.plan_type && <span className="meta-chip"><span className="k">Plan</span> {summary.plan_type}</span>}
            <span className="meta-chip"><span className="k">ID</span> {auditId.slice(0, 8)}</span>
          </div>
          {!failed && (
            <div style={{ marginTop: "0.5rem" }}>
              <AuditStepper auditId={auditId} doneAll={doneAll} failed={failed} realCount={summary?.real_count ?? 0} />
            </div>
          )}
        </div>
        <div className="beacon-page-actions">
          {!isDemo && (
            <button type="button" className="b-btn secondary" onClick={toggleSound}>
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          )}
          <Link className="b-btn secondary" to={`/app/patient/results/${auditId}`}>
            <IcoDownload /> Results
          </Link>
          {doneAll && summary?.complaint_eligible && (
            <Link className="b-btn accent" to={`/app/patient/results/${auditId}`}>
              <IcoSparkles /> Generate report
            </Link>
          )}
        </div>
      </div>

      {/* ── Alert banners ── */}
      {highGhost && !doneAll && !failed && done >= 5 && (
        <div className="beacon-alert-banner">
          <div className="beacon-alert-icon"><IcoAlert /></div>
          <div className="beacon-alert-body">
            <div className="beacon-alert-title">Network adequacy threshold exceeded</div>
            <div className="beacon-alert-msg">
              Ghost rate of {ghostPct}% exceeds the 30% CMS adequacy threshold for behavioral health.
              A complaint draft may be available when the audit completes.
            </div>
          </div>
          <Link className="b-btn sm secondary" to={`/app/patient/results/${auditId}`}>Review options</Link>
        </div>
      )}
      {failed && summary && (
        <div className="beacon-alert-banner">
          <div className="beacon-alert-icon"><IcoAlert /></div>
          <div className="beacon-alert-body">
            <div className="beacon-alert-title">Audit failed</div>
            <div className="beacon-alert-msg">{summary.error || "The audit stopped due to an error. Partial results may still be useful."}</div>
          </div>
          <Link className="b-btn sm secondary" to="/app/patient">Start over</Link>
        </div>
      )}
      {err && <p className="err" style={{ marginBottom: "1rem" }}>{err}</p>}

      {/* ── Completion card ── */}
      {doneAll && !failed && (
        <div className="beacon-completion-card">
          <div className="beacon-ck-eyebrow"><IcoSparkles /> Audit complete · {done} of {total} providers verified</div>
          <h2>
            Of {total} listed providers, only{" "}
            <span className="serif" style={{ color: "var(--accent)" }}>{summary?.real_count} were reachable</span>
            {" "}and accepting new patients.
          </h2>
          <p>
            That's a <strong style={{ color: "var(--text)" }}>{ghostPct}% ghost rate</strong>
            {parseFloat(ghostPct) > 30 ? " — above the 30% CMS network-adequacy threshold." : "."}
            {summary?.complaint_eligible ? " A complaint draft is ready to generate." : ""}
          </p>
          <div className="beacon-ck-actions">
            <Link className="b-btn accent" to={`/app/patient/results/${auditId}`}><IcoSparkles /> View results</Link>
            {summary?.complaint_eligible && (
              <Link className="b-btn secondary" to={`/app/patient/results/${auditId}`}>Generate complaint →</Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI grid ── */}
      <div className="beacon-kpi-grid">
        <KPI label="Ghost rate" icon={<IcoAlert />}
          value={ghostPct} unit="%"
          trend={parseFloat(ghostPct) > 30 ? `+${(parseFloat(ghostPct) - 30).toFixed(0)} pts over threshold` : "Within threshold"}
          trendDir={parseFloat(ghostPct) > 30 ? "bad" : "good"}
          foot={<>{done} of {total} calls completed{!doneAll && done > 0 ? " (live)" : ""}</>}
          spark={sparks.rate} sparkColor="var(--danger)" />
        <KPI label="Verified providers" icon={<IcoCheck />}
          value={summary?.real_count ?? 0} unit={"/" + total}
          foot={<><strong>{(100 - parseFloat(ghostPct)).toFixed(0)}%</strong> directory accuracy</>}
          spark={sparks.verified} sparkColor="var(--success)" />
        <KPI label="Ghost providers" icon={<IcoX />}
          value={summary?.ghost_count ?? 0}
          foot={<>{summary?.voicemail_count ?? 0} voicemail · {summary?.other_count ?? 0} other</>}
          spark={sparks.ghosts} sparkColor="var(--danger)" />
        <KPI label="Progress" icon={<IcoChart />}
          value={Math.round(progress)} unit="%"
          foot={doneAll ? `Completed in ${elapsedStr}` : etaSeconds ? `~${etaSeconds}s remaining` : "In progress"}
          spark={sparks.prog} sparkColor="var(--accent)" />
      </div>

      {/* ── Live audit panel (left side only) ── */}
      <div className="beacon-audit-panel">
        <div className="beacon-audit-panel-head">
          <div className="lhs">
            <div>
              <h2>Live audit progress</h2>
              <div className="sub">Real-time verification of {total} providers · elapsed {elapsedStr}</div>
            </div>
          </div>
          <div className="rhs">
            {doneAll && <span>Audit completed in <strong>{elapsedStr}</strong></span>}
          </div>
        </div>
        <div className="beacon-audit-panel-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="audit-progress-side">
            <div className="ring-stat">
              <Ring pct={Math.round(summary?.ghost_rate ? summary.ghost_rate * 100 : 0)} />
              <div className="ring-info">
                <h3>{summary?.ghost_count ?? 0} of {done || 1} calls couldn't reach a real provider</h3>
                <p>We measure ghosts as disconnected numbers, providers who've left the practice, or offices not accepting new in-network patients.</p>
              </div>
            </div>
            <div className="audit-breakdown-row">
              <div className="audit-bd-stat real">
                <span className="audit-bd-dot" />
                <div className="audit-bd-lbl">Reachable</div>
                <div className="audit-bd-val">{summary?.real_count ?? 0}</div>
              </div>
              <div className="audit-bd-stat ghost">
                <span className="audit-bd-dot" />
                <div className="audit-bd-lbl">Ghosted</div>
                <div className="audit-bd-val">{summary?.ghost_count ?? 0}</div>
              </div>
              <div className="audit-bd-stat vm">
                <span className="audit-bd-dot" />
                <div className="audit-bd-lbl">Voicemail</div>
                <div className="audit-bd-val">{summary?.voicemail_count ?? 0}</div>
              </div>
            </div>
            <div className="progress-bar-block">
              <div className="progress-bar-block-head">
                <span className="lbl">Audit progress</span>
                <span className="val">{done} of {total} · {Math.round(progress)}%</span>
              </div>
              <div className="beacon-progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="beacon-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
