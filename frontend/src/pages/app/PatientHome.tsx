import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { DEMO_AUDIT_ID } from "../../demo-data";
import { useLocale } from "../../locale";

export default function PatientHome() {
  const { t } = useLocale();
  const { user } = useAuth();

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
          <Link to={`/app/patient/audits/${DEMO_AUDIT_ID}`} className="btn secondary">
            {t("patientHomeDemoCta")}
          </Link>
        </div>
      </header>

      <section className="section">
        <h2 className="section__title">{t("patientHomeRecentTitle")}</h2>
        <div className="card empty-card">
          <p className="lede" style={{ marginBottom: 0 }}>
            {t("patientHomeRecentEmpty")}
          </p>
        </div>
      </section>
    </div>
  );
}
