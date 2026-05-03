import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

export default function HowItWorks() {
  const { t } = useLocale();

  return (
    <div className="marketing-page">
      <section className="hero hero--compact">
        <div className="hero__eyebrow">{t("howEyebrow")}</div>
        <h1 className="hero__title">{t("howTitle")}</h1>
        <p className="hero__lede">{t("howLede")}</p>
      </section>

      <section className="section">
        <ol className="steps">
          <li className="step">
            <div className="step__num">1</div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep1Title")}</h3>
              <p>{t("howStep1Body")}</p>
            </div>
          </li>
          <li className="step">
            <div className="step__num">2</div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep2Title")}</h3>
              <p>{t("howStep2Body")}</p>
            </div>
          </li>
          <li className="step">
            <div className="step__num">3</div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep3Title")}</h3>
              <p>{t("howStep3Body")}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section section--alt">
        <div className="dashboard-preview" aria-hidden>
          <div className="dashboard-preview__row">
            <div className="dashboard-preview__chip ghost">Ghost</div>
            <div className="dashboard-preview__chip ghost">Ghost</div>
            <div className="dashboard-preview__chip real">Real</div>
            <div className="dashboard-preview__chip voicemail">Voicemail</div>
          </div>
          <div className="dashboard-preview__row">
            <div className="dashboard-preview__chip real">Real</div>
            <div className="dashboard-preview__chip ghost">Ghost</div>
            <div className="dashboard-preview__chip ghost">Ghost</div>
            <div className="dashboard-preview__chip ghost">Ghost</div>
          </div>
        </div>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("howPreviewCaption")}
        </p>
        <div className="section__cta">
          <Link to="/signup" className="btn">
            {t("howCtaSignup")}
          </Link>
          <Link to="/pricing" className="btn secondary">
            {t("howCtaPricing")}
          </Link>
        </div>
      </section>
    </div>
  );
}
