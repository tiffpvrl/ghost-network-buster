import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, type AuditSummary } from "../../api";
import { useAuth } from "../../auth/AuthProvider";
import {
  listPatientAuditsByCreatedAt,
  updatePatientAudit,
  type PatientAuditRecord,
} from "../../data/patientAudits";
import { DEMO_AUDIT_ID } from "../../demo-data";
import { useLocale } from "../../locale";

export default function PatientHome() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [recent, setRecent] = useState<PatientAuditRecord[]>(() =>
    listPatientAuditsByCreatedAt().slice(0, 5),
  );

  // Lazy-refresh non-terminal entries on mount.
  useEffect(() => {
    let cancelled = false;
    const inFlight = recent.filter(
      (r) => r.latestStatus !== "completed" && r.latestStatus !== "failed",
    );
    if (inFlight.length === 0) return;
    (async () => {
      const updates: PatientAuditRecord[] = [];
      for (const rec of inFlight) {
        try {
          const s = await apiGet<AuditSummary>(`/api/summary/${rec.id}`);
          if (cancelled) return;
          const next = updatePatientAudit(rec.id, {
            latestStatus:
              s.status === "completed" || s.status === "failed" || s.status === "running"
                ? s.status
                : rec.latestStatus,
            ghostRate: s.ghost_rate ?? rec.ghostRate,
            realCount: s.real_count ?? rec.realCount,
            completedAt: s.completed_at ?? rec.completedAt,
          });
          if (next) updates.push(next);
        } catch {
          /* ignore — keep cached snapshot */
        }
      }
      if (cancelled || updates.length === 0) return;
      setRecent(listPatientAuditsByCreatedAt().slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mostRecent = recent[0];
  const demoHref = mostRecent
    ? `/app/patient/audits/${DEMO_AUDIT_ID}?carrier=${encodeURIComponent(mostRecent.carrier)}&zip=${encodeURIComponent(mostRecent.zip)}&needs=${encodeURIComponent(mostRecent.careNeeds.join(","))}&planType=${encodeURIComponent(mostRecent.planType)}`
    : `/app/patient/audits/${DEMO_AUDIT_ID}`;

  return (
    <div className="patient-home">
      <header className="patient-home__hero">
        <div className="hero__eyebrow">{t("patientHomeEyebrow")}</div>
        <h1 className="patient-home__title">
          {t("patientHomeGreeting", { email: user?.email ?? "" })}
        </h1>
        <p className="lede" style={{ maxWidth: "60ch" }}>
          {t("patientHomeBody")}
        </p>
        <div className="hero__actions">
          <Link to="/app/patient/audits/new" className="btn">
            {t("patientHomeStartCta")}
          </Link>
          <Link to={demoHref} className="btn secondary">
            {t("patientHomeDemoCta")}
          </Link>
        </div>
      </header>

      <section className="section">
        <h2 className="section__title">{t("patientHomeRecentTitle")}</h2>
        {recent.length === 0 ? (
          <div className="card empty-card">
            <p className="lede" style={{ marginBottom: 0 }}>
              {t("patientHomeRecentEmpty")}
            </p>
          </div>
        ) : (
          <ul className="batch-list" role="list">
            {recent.map((r) => {
              const isLive =
                r.latestStatus !== "completed" && r.latestStatus !== "failed";
              const href = isLive
                ? `/app/patient/audits/${r.id}`
                : `/app/patient/results/${r.id}`;
              const ghostPart =
                r.ghostRate != null && Number.isFinite(r.ghostRate)
                  ? t("patientHomeRowGhost", {
                      pct: (r.ghostRate * 100).toFixed(0),
                    })
                  : null;
              return (
                <li key={r.id} className="batch-list__row">
                  <Link to={href} className="batch-list__link">
                    <div>
                      <div className="batch-list__id">
                        {r.carrier}{" "}
                        <span className="mono-id" style={{ fontSize: "0.85em", color: "var(--muted)" }}>
                          ZIP {r.zip}
                        </span>
                      </div>
                      <div className="batch-list__meta">
                        {t("patientHomeRowMeta", {
                          plan: r.planType,
                          needs: r.careNeeds.slice(0, 2).join(", ") || "—",
                        })}
                        {ghostPart ? ` · ${ghostPart}` : ""}
                      </div>
                    </div>
                    <div className="batch-list__when">
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                    <span className={`pill ${r.latestStatus === "completed" ? "real" : r.latestStatus === "failed" ? "ghost" : "voicemail"}`}>
                      {r.latestStatus}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
