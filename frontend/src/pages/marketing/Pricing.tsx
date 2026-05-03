import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flexShrink: 0, color: "var(--real)" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Pricing() {
  const { t } = useLocale();

  return (
    <div className="marketing-page">
      <section className="hero hero--compact">
        <div className="hero__eyebrow">{t("pricingEyebrow")}</div>
        <h1 className="hero__title">{t("pricingTitle")}</h1>
        <p className="hero__lede">{t("pricingLede")}</p>
      </section>

      {/* ── For individuals ─────────────────────────────────── */}
      <section className="section">
        <div className="pricing-section-head">
          <h2 className="section__title">{t("pricingIndividualsTitle")}</h2>
          <p className="lede" style={{ maxWidth: "62ch" }}>{t("pricingIndividualsLead")}</p>
        </div>

        <div className="price-mini-grid">
          <div className="price-card">
            <div className="price-card__eyebrow">{t("pricingUnlockTitle")}</div>
            <div className="price-card__amount">
              <span className="price-card__currency">$</span>
              <span className="price-card__value">4.99</span>
              <span className="price-card__unit">{t("pricingUnlockUnit")}</span>
            </div>
            <p className="price-card__note" style={{ textAlign: "left", marginTop: 0 }}>
              {t("pricingUnlockBody")}
            </p>
            <Link to="/signup" className="btn full">{t("pricingCta")}</Link>
          </div>

          <div className="price-card price-card--accent">
            <div className="price-card__eyebrow">{t("pricingBundleTitle")}</div>
            <div className="price-card__amount">
              <span className="price-card__currency">$</span>
              <span className="price-card__value">12.99</span>
              <span className="price-card__unit">{t("pricingBundleUnit")}</span>
            </div>
            <p className="price-card__note" style={{ textAlign: "left", marginTop: 0 }}>
              {t("pricingBundleBody")}
            </p>
            <Link to="/signup" className="btn full">{t("pricingCta")}</Link>
          </div>
        </div>

        <p className="pricing-individuals-paragraph">
          {t("pricingIndividualsParagraph")}
        </p>
        <p className="price-card__note" style={{ marginTop: "0.5rem" }}>
          {t("pricingNote")}
        </p>
      </section>

      {/* ── For businesses ──────────────────────────────────── */}
      <section className="section section--alt">
        <div className="pricing-section-head">
          <h2 className="section__title">{t("pricingBusinessesTitle")}</h2>
          <p className="lede" style={{ maxWidth: "62ch" }}>{t("pricingBusinessesLead")}</p>
        </div>

        <ul className="tier-list" role="list">
          <li className="tier-row">
            <Link
              to="/signup?role=employer&plan=tier-starter"
              className="tier-row__link"
              aria-label={`${t("pricingTierStarterName")} — ${t("pricingTierStarterPrice")}`}
            >
              <div className="tier-row__name">{t("pricingTierStarterName")}</div>
              <div className="tier-row__price">
                <span className="tier-row__amount">{t("pricingTierStarterPrice")}</span>
                <span className="tier-row__unit">{t("pricingTierMonthly")}</span>
              </div>
              <div className="tier-row__body"><IconCheck /><span>{t("pricingTierStarterBody")}</span></div>
            </Link>
          </li>
          <li className="tier-row tier-row--accent">
            <Link
              to="/signup?role=employer&plan=tier-growth"
              className="tier-row__link"
              aria-label={`${t("pricingTierGrowthName")} — ${t("pricingTierGrowthPrice")}`}
            >
              <div className="tier-row__name">{t("pricingTierGrowthName")}</div>
              <div className="tier-row__price">
                <span className="tier-row__amount">{t("pricingTierGrowthPrice")}</span>
                <span className="tier-row__unit">{t("pricingTierMonthly")}</span>
              </div>
              <div className="tier-row__body"><IconCheck /><span>{t("pricingTierGrowthBody")}</span></div>
            </Link>
          </li>
          <li className="tier-row">
            <Link
              to="/signup?role=employer&plan=tier-enterprise"
              className="tier-row__link"
              aria-label={`${t("pricingTierEnterpriseName")} — ${t("pricingTierEnterprisePrice")}`}
            >
              <div className="tier-row__name">{t("pricingTierEnterpriseName")}</div>
              <div className="tier-row__price">
                <span className="tier-row__amount">{t("pricingTierEnterprisePrice")}</span>
              </div>
              <div className="tier-row__body"><IconCheck /><span>{t("pricingTierEnterpriseBody")}</span></div>
            </Link>
          </li>
        </ul>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="section">
        <h2 className="section__title">{t("pricingFaqTitle")}</h2>
        <details className="faq">
          <summary>{t("pricingFaq1Q")}</summary>
          <p>{t("pricingFaq1A")}</p>
        </details>
        <details className="faq">
          <summary>{t("pricingFaq2Q")}</summary>
          <p>{t("pricingFaq2A")}</p>
        </details>
        <details className="faq">
          <summary>{t("pricingFaq3Q")}</summary>
          <p>{t("pricingFaq3A")}</p>
        </details>
      </section>
    </div>
  );
}
