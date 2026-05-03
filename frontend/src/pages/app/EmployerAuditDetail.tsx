import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiGet, type AuditSummary } from "../../api";
import { getSimSummary, isSimAuditId } from "../../data/employerSim";
import { ghostReasonLabelLong } from "../../labels";
import { useLocale } from "../../locale";

const SIM_POLL_MS = 1000;

export default function EmployerAuditDetail() {
  const { t } = useLocale();
  const { auditId } = useParams();
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  const refreshSim = useCallback((id: string) => {
    const s = getSimSummary(id);
    if (s) setSummary(s);
    else setErr(t("employerDetailMissing"));
  }, [t]);

  // Simulated audit: poll the in-memory summary every second.
  useEffect(() => {
    if (!auditId || !isSimAuditId(auditId)) return;
    stoppedRef.current = false;
    let timer: number | null = null;
    const tick = () => {
      if (stoppedRef.current) return;
      refreshSim(auditId);
      timer = window.setTimeout(tick, SIM_POLL_MS);
    };
    tick();
    return () => {
      stoppedRef.current = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [auditId, refreshSim]);

  // Real audit: fetch once then poll on a slightly slower cadence until done.
  useEffect(() => {
    if (!auditId || isSimAuditId(auditId)) return;
    let cancelled = false;
    let timer: number | null = null;
    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (!cancelled) {
          setSummary(s);
          setErr(null);
          if (s.status === "running") timer = window.setTimeout(tick, 2000);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : String(e));
        }
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [auditId]);

  if (!auditId) {
    return (
      <div className="results-page" role="alert">
        <h1>{t("employerDetailMissingTitle")}</h1>
        <p className="lede">{t("employerDetailMissing")}</p>
      </div>
    );
  }

  if (err && !summary) {
    return (
      <div className="results-page" role="alert">
        <h1>{t("employerDetailMissingTitle")}</h1>
        <p className="lede">{err}</p>
        <Link to="/app/employer" className="btn secondary">
          {t("batchBackToEmployer")}
        </Link>
      </div>
    );
  }

  if (!summary) return <p className="lede">{t("loading")}</p>;

  const ghostPct = (summary.ghost_rate * 100).toFixed(1);
  const concerning = summary.results
    .filter((r) => r.status === "ghost")
    .slice(0, 3);

  return (
    <div className="employer-audit-detail">
      <header style={{ marginBottom: "1rem" }}>
        <div className="hero__eyebrow">{t("employerDetailEyebrow")}</div>
        <h1 className="patient-home__title">
          {summary.carrier}{" "}
          <span className="mono-id" style={{ fontSize: "0.7em", color: "var(--muted)" }}>
            ZIP {summary.zip_code}
          </span>
        </h1>
        <p className="lede" style={{ maxWidth: "62ch", marginBottom: "0.4rem" }}>
          {t("employerDetailLede")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <span className={`pill ${summary.status === "completed" ? "real" : summary.status === "failed" ? "ghost" : "voicemail"}`}>
            {summary.status}
          </span>
          {summary.high_ghost_rate ? (
            <span className="tier-badge" style={{ background: "color-mix(in srgb, var(--ghost) 15%, transparent)", color: "var(--ghost)" }}>
              {t("employerDetailHighGhost")}
            </span>
          ) : null}
        </div>
      </header>

      <div className="kpi-row" style={{ marginBottom: "1.25rem" }}>
        <div className="kpi">
          <div className="val">{summary.calls_completed}/{summary.providers_total}</div>
          <div className="lbl">{t("employerDetailKpiCalls")}</div>
        </div>
        <div className="kpi ghost-kpi">
          <div className="val">{ghostPct}%</div>
          <div className="lbl">{t("employerDetailKpiGhost")}</div>
        </div>
        <div className="kpi real-kpi">
          <div className="val">{summary.real_count}</div>
          <div className="lbl">{t("employerDetailKpiReal")}</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.voicemail_count}</div>
          <div className="lbl">{t("employerDetailKpiVoicemail")}</div>
        </div>
      </div>

      <section className="card concerning-list" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.6rem" }}>{t("employerDetailConcerning")}</h2>
        {concerning.length === 0 ? (
          <p className="lede" style={{ marginBottom: 0 }}>
            {t("employerDetailConcerningEmpty")}
          </p>
        ) : (
          <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {concerning.map((row) => (
              <li key={row.npi} className="concerning-list__row">
                <div>
                  <div className="concerning-list__name">{row.provider_name || row.npi}</div>
                  <div className="concerning-list__summary">{row.summary}</div>
                </div>
                <span className="ghost-reason-chip">
                  {ghostReasonLabelLong(row.ghost_reason)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="lede" style={{ fontSize: "0.78rem", marginTop: "0.85rem", marginBottom: 0 }}>
          {t("employerDetailNoTranscripts")}
        </p>
      </section>
    </div>
  );
}
