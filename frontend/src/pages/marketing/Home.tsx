import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

export default function Home() {
  const { t } = useLocale();

  return (
    <div className="marketing-page">
      <section className="hero">
        <div className="hero__eyebrow">{t("homeEyebrow")}</div>
        <h1 className="hero__title">{t("homeTitle")}</h1>
        <p className="hero__lede">{t("homeLede")}</p>
        <div className="hero__actions">
          <Link to="/signup" className="btn">
            {t("homeCtaSignup")}
          </Link>
          <Link to="/login" className="btn secondary">
            {t("homeCtaLogin")}
          </Link>
        </div>
        <p className="hero__sub">{t("homeTrust")}</p>
      </section>

      <section className="section">
        <h2 className="section__title">{t("homeWhoTitle")}</h2>
        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-card__eyebrow">{t("homePatientEyebrow")}</div>
            <h3 className="feature-card__title">{t("homePatientTitle")}</h3>
            <p className="feature-card__body">{t("homePatientBody")}</p>
            <Link to="/signup?role=patient" className="feature-card__link">
              {t("homePatientCta")}
            </Link>
          </article>
          <article className="feature-card">
            <div className="feature-card__eyebrow">{t("homeEmployerEyebrow")}</div>
            <h3 className="feature-card__title">{t("homeEmployerTitle")}</h3>
            <p className="feature-card__body">{t("homeEmployerBody")}</p>
            <Link to="/signup?role=employer" className="feature-card__link">
              {t("homeEmployerCta")}
            </Link>
          </article>
        </div>
      </section>

      <section className="section section--alt">
        <h2 className="section__title">{t("homeWhatTitle")}</h2>
        <ul className="bullet-list">
          <li>{t("homeWhatBullet1")}</li>
          <li>{t("homeWhatBullet2")}</li>
          <li>{t("homeWhatBullet3")}</li>
        </ul>
        <div className="section__cta">
          <Link to="/how-it-works" className="btn secondary">
            {t("homeLearnMore")}
          </Link>
          <Link to="/pricing" className="btn">
            {t("homePricingCta")}
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">{t("homeTrustTitle")}</h2>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("homeTrustBody")}
        </p>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("homeTrustCrisis")}{" "}
          <a href="tel:988">988</a>
          {" · "}
          <a href="https://988lifeline.org/" rel="noopener noreferrer" target="_blank">
            {t("crisisLinks")}
          </a>
          {" · "}
          <a href="https://nycwell.cityofnewyork.us/" rel="noopener noreferrer" target="_blank">
            {t("crisisNyc")}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
