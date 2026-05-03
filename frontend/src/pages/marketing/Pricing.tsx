import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

const PRICE = import.meta.env.VITE_PRICE_PER_AUDIT_USD ?? "49";

export default function Pricing() {
  const { t } = useLocale();

  return (
    <div className="marketing-page">
      <section className="hero hero--compact">
        <div className="hero__eyebrow">{t("pricingEyebrow")}</div>
        <h1 className="hero__title">{t("pricingTitle")}</h1>
        <p className="hero__lede">{t("pricingLede")}</p>
      </section>

      <section className="section">
        <div className="price-card">
          <div className="price-card__eyebrow">{t("pricingCardEyebrow")}</div>
          <div className="price-card__amount">
            <span className="price-card__currency">$</span>
            <span className="price-card__value">{PRICE}</span>
            <span className="price-card__unit">{t("pricingPerAudit")}</span>
          </div>
          <ul className="price-card__list">
            <li>{t("pricingIncl1")}</li>
            <li>{t("pricingIncl2")}</li>
            <li>{t("pricingIncl3")}</li>
            <li>{t("pricingIncl4")}</li>
          </ul>
          <Link to="/signup" className="btn full">
            {t("pricingCta")}
          </Link>
          <p className="price-card__note">{t("pricingNote")}</p>
        </div>
      </section>

      <section className="section section--alt">
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
