import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { listByCreatedAt, type EmployerBatch } from "../../data/employerBatches";
import { useLocale } from "../../locale";
import Employer from "../Employer";

/**
 * Employer workspace landing page. Shows tier badge, primary CTA to start a new
 * batch audit, and recent batches the user has run. The illustrative aggregates
 * dashboard from the existing Employer page is kept below as reference data.
 */
export default function EmployerHome() {
  const { t } = useLocale();
  const { employerTier } = useAuth();
  const recent: EmployerBatch[] = listByCreatedAt().slice(0, 5);

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

      <section className="section section--alt">
        <div className="section__title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
          <h2 className="section__title" style={{ margin: 0 }}>
            {t("employerHomeReferenceTitle")}
          </h2>
          <span className="tier-badge tier-badge--muted">{t("employerHomeReferenceTag")}</span>
        </div>
        <Employer />
      </section>
    </div>
  );
}
