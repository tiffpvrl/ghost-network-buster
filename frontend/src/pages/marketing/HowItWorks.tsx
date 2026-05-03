import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12.5 19.79 19.79 0 0 1 1.65 3.9 2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

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
            <div className="step__icon-wrap">
              <div className="step__num">1</div>
              <div className="step__icon"><IconKey /></div>
            </div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep1Title")}</h3>
              <p>{t("howStep1Body")}</p>
            </div>
          </li>
          <li className="step">
            <div className="step__icon-wrap">
              <div className="step__num">2</div>
              <div className="step__icon"><IconPhone /></div>
            </div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep2Title")}</h3>
              <p>{t("howStep2Body")}</p>
            </div>
          </li>
          <li className="step">
            <div className="step__icon-wrap">
              <div className="step__num">3</div>
              <div className="step__icon"><IconClipboard /></div>
            </div>
            <div className="step__body">
              <h3 className="step__title">{t("howStep3Title")}</h3>
              <p>{t("howStep3Body")}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section section--alt">
        <p className="mktg-preview-label">Sample audit result</p>
        <div className="dashboard-preview" aria-hidden="true">
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
