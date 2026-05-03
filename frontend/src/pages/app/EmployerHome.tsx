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

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function EmployerHome() {
  const { t } = useLocale();
  const { employerTier } = useAuth();
  const [recent] = useState<EmployerBatch[]>(() => listByCreatedAt().slice(0, 5));
  const [headcount, setHeadcount] = useState<number>(DEFAULT_HEADCOUNT);
  const [agg, setAgg] = useState<EmployerAggregates>(() => loadEmployerAggregates());
  const [orgName, setOrgName] = useState<string>("");
  const [benefitsLead, setBenefitsLead] = useState<string>("");

  // Refresh aggregates every 2s while any batch is still running, otherwise
  // every 8s so newly completed batches surface without manual reload.
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
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  const exposure = useMemo(() => estimateExposureUsd(agg, headcount), [agg, headcount]);
  const hasData = agg.totals.audits > 0;
  const disabledTitle = hasData ? "" : t("employerPacketDisabledTitle");

  function handleMemo() {
    if (!hasData) return;
    downloadFindingsMemo(agg, {
      headcount,
      orgName: orgName.trim() || undefined,
      benefitsLead: benefitsLead.trim() || undefined,
    });
  }

  function handleExec() {
    if (!hasData) return;
    downloadExecutiveSummary(agg, {
      headcount,
      orgName: orgName.trim() || undefined,
    });
  }

  function handleCsv() {
    if (!hasData) return;
    downloadEvidenceCsv(flatEvidenceRows());
  }

  return (
    <div className="employer-home">
      <header className="patient-home__hero">
        <div className="hero__eyebrow">
          {t("employerWorkspaceTitle")}
          {employerTier ? (
            <span className="tier-badge" style={{ marginLeft: "0.5rem" }}>
              {t("employerTierLabel", { tier: employerTier })}
            </span>
          ) : (
            <span className="tier-badge tier-badge--muted" style={{ marginLeft: "0.5rem" }}>
              {t("employerTierNone")}
            </span>
          )}
        </div>
        <h1 className="patient-home__title">{t("employerHomeTitle")}</h1>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("employerHomeBody")}
        </p>
        <div className="hero__actions">
          <Link to="/app/employer/audits/new" className="btn">
            {t("employerHomeRunNewAudit")}
          </Link>
          {employerTier === null ? (
            <Link to="/pricing" className="btn secondary">
              {t("employerHomeSelectPlan")}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="section">
        <h2 className="section__title">{t("employerHomeRecentTitle")}</h2>
        {recent.length === 0 ? (
          <div className="card empty-card">
            <p className="lede" style={{ marginBottom: 0 }}>
              {t("employerHomeRecentEmpty")}
            </p>
          </div>
        ) : (
          <ul className="batch-list" role="list">
            {recent.map((b) => (
              <li key={b.id} className="batch-list__row">
                <Link to={`/app/employer/batches/${b.id}`} className="batch-list__link">
                  <div>
                    <div className="batch-list__id mono-id">{b.id.slice(0, 8)}</div>
                    <div className="batch-list__meta">
                      {t("employerHomeRecentMeta", {
                        carriers: b.carriers.length,
                        zips: b.zips.length,
                        total: b.audits.length,
                      })}
                    </div>
                  </div>
                  <div className="batch-list__when">
                    {new Date(b.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                  <span className={`pill ${b.status === "completed" ? "real" : b.status === "failed" ? "ghost" : "voicemail"}`}>
                    {b.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <div
          className="section__title-row"
          style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.5rem" }}
        >
          <h2 className="section__title" style={{ margin: 0 }}>
            {t("employerHealthTitle")}
          </h2>
          {agg.totals.auditsRunning > 0 ? (
            <span className="tier-badge tier-badge--muted">
              {t("employerHealthRunning", { n: agg.totals.auditsRunning })}
            </span>
          ) : null}
        </div>

        {!hasData ? (
          <div className="card empty-card">
            <p className="lede" style={{ marginBottom: "0.6rem" }}>
              {t("employerHealthEmpty")}
            </p>
            <Link to="/app/employer/audits/new" className="btn">
              {t("employerHomeRunNewAudit")}
            </Link>
          </div>
        ) : (
          <div className="health-grid">
            {/* Ghost rate by carrier */}
            <div className="card">
              <h3 style={{ marginBottom: "0.85rem" }}>
                {t("employerHealthGhostByCarrier")}
              </h3>
              <div>
                {agg.byCarrier.map((row) => (
                  <div key={row.carrier} className="ghost-bar-row">
                    <div className="ghost-bar-row__name">{row.carrier}</div>
                    <div className="ghost-bar-track" aria-hidden="true">
                      <div
                        className="ghost-bar-fill"
                        style={{ width: `${Math.round(row.ghostRate * 100)}%` }}
                      />
                    </div>
                    <div className="ghost-bar-row__val mono-id">
                      {(row.ghostRate * 100).toFixed(0)}%
                    </div>
                    <div className="ghost-bar-row__count">
                      {row.audits} {row.audits === 1 ? "audit" : "audits"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial exposure */}
            <div className="card">
              <h3 style={{ marginBottom: "0.6rem" }}>
                {t("employerHealthExposureTitle")}
              </h3>
              <p className="lede" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
                {t("employerHealthExposureNote")}
              </p>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}
              >
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {t("employerHealthExposureHeadcount")}
                </span>
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={headcount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n > 0) setHeadcount(n);
                  }}
                  style={{ width: 120 }}
                />
              </label>
              <div className="exposure-amount">{formatUsd(exposure)}</div>
              <div className="exposure-sub">{t("employerHealthExposureSub")}</div>
            </div>

            {/* Broken specialty callouts */}
            {agg.brokenSpecialties.length > 0 ? (
              <div className="card">
                <h3 style={{ marginBottom: "0.6rem" }}>
                  {t("employerHealthBrokenTitle")}
                </h3>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {agg.brokenSpecialties.map((b) => (
                    <li key={b.need} style={{ marginBottom: "0.4rem" }}>
                      <strong>{b.need}</strong> —{" "}
                      <span style={{ color: "var(--muted)" }}>
                        {t("employerHealthBrokenRow", { n: b.auditsWithNeed })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Coverage gaps by ZIP */}
            <div className="card">
              <h3 style={{ marginBottom: "0.6rem" }}>
                {t("employerHealthGapsTitle")}
              </h3>
              {agg.byZip.length === 0 ? (
                <p className="lede" style={{ marginBottom: 0 }}>
                  {t("employerHealthGapsEmpty")}
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                  {agg.byZip.slice(0, 5).map((z) => (
                    <li key={z.zip} className="gap-row">
                      <span className="mono-id">ZIP {z.zip}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {t("employerHealthGapRow", {
                          real: z.realCount,
                          ghost: z.ghostCount,
                          audits: z.audits,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section__title">{t("employerPacketTitle")}</h2>
        <div className="card">
          <p className="lede" style={{ marginBottom: "0.4rem" }}>
            {t("employerPacketBody")}
          </p>

          <h3 style={{ margin: "0.85rem 0 0", fontSize: "0.95rem" }}>
            {t("employerReportContextTitle")}
          </h3>
          <p
            style={{
              margin: "0.2rem 0 0",
              fontSize: "0.78rem",
              color: "var(--muted)",
            }}
          >
            {t("employerReportContextHelp")}
          </p>
          <div className="report-context">
            <label>
              <span>{t("employerReportContextOrg")}</span>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("employerReportContextOrgPlaceholder")}
                maxLength={120}
              />
            </label>
            <label>
              <span>{t("employerReportContextLead")}</span>
              <input
                type="text"
                value={benefitsLead}
                onChange={(e) => setBenefitsLead(e.target.value)}
                placeholder={t("employerReportContextLeadPlaceholder")}
                maxLength={120}
              />
            </label>
          </div>

          <div className="packet-actions">
            <button
              type="button"
              className="btn"
              onClick={handleMemo}
              disabled={!hasData}
              title={disabledTitle}
            >
              {t("employerPacketMemoCta")}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={handleExec}
              disabled={!hasData}
              title={disabledTitle}
            >
              {t("employerPacketExecCta")}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={handleCsv}
              disabled={!hasData}
              title={disabledTitle}
            >
              {t("employerPacketCsvCta")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
