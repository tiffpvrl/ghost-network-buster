import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useLocale } from "../../locale";

const PRICE = import.meta.env.VITE_PRICE_PER_AUDIT_USD ?? "49";
const DEMO_LABEL = import.meta.env.VITE_DEMO_CHECKOUT_LABEL ?? "Demo checkout — no card charged";

export default function Checkout() {
  const { t } = useLocale();
  const { user, addCredits } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);

  if (!user) {
    const next = encodeURIComponent("/checkout");
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  function pay() {
    setBusy(true);
    window.setTimeout(() => {
      addCredits(1);
      const next = params.get("next");
      const dest = next ? decodeURIComponent(next) : "/app/patient/audits/new?paid=1";
      nav(dest, { replace: true });
    }, 450);
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-card__eyebrow">{t("checkoutEyebrow")}</div>
        <h1 className="auth-card__title">{t("checkoutTitle")}</h1>
        <p className="banner" style={{ marginBottom: "1rem" }}>
          {DEMO_LABEL}
        </p>

        <div className="order-summary">
          <div className="order-summary__row">
            <span>{t("checkoutItem")}</span>
            <span className="mono-id">${PRICE}.00</span>
          </div>
          <div className="order-summary__row order-summary__row--total">
            <span>{t("checkoutTotal")}</span>
            <span className="mono-id">${PRICE}.00</span>
          </div>
        </div>

        <p className="lede" style={{ fontSize: "0.78rem", marginBottom: "1rem" }}>
          {t("checkoutWhat")}
        </p>

        <button type="button" className="btn full" onClick={pay} disabled={busy}>
          {busy ? t("checkoutProcessing") : t("checkoutPay", { price: PRICE })}
        </button>
        <p className="auth-card__alt">
          <Link to="/app/patient">{t("checkoutCancel")}</Link>
        </p>
      </div>
    </div>
  );
}
