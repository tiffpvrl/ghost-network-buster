import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type EmployerTier } from "../../auth/AuthProvider";
import { useLocale } from "../../locale";

const DEMO_LABEL =
  import.meta.env.VITE_DEMO_CHECKOUT_LABEL ?? "Demo checkout — no card charged";

type PlanId =
  | "unlock"
  | "letter"
  | "bundle"
  | "tier-starter"
  | "tier-growth"
  | "tier-enterprise";

type PlanDef = {
  id: PlanId;
  titleKey: string;
  priceLabel: string;
  whatKey: string;
  cta: "pay" | "contact";
  tier?: EmployerTier;
  redirect: (auditId?: string) => string;
};

const PLANS: Record<PlanId, PlanDef> = {
  unlock: {
    id: "unlock",
    titleKey: "checkoutPlanUnlockTitle",
    priceLabel: "$4.99",
    whatKey: "checkoutPlanUnlockWhat",
    cta: "pay",
    redirect: (auditId) => (auditId ? `/app/patient/results/${auditId}` : "/app/patient"),
  },
  letter: {
    id: "letter",
    titleKey: "checkoutPlanLetterTitle",
    priceLabel: "$8.00",
    whatKey: "checkoutPlanLetterWhat",
    cta: "pay",
    redirect: (auditId) => (auditId ? `/app/patient/results/${auditId}` : "/app/patient"),
  },
  bundle: {
    id: "bundle",
    titleKey: "checkoutPlanBundleTitle",
    priceLabel: "$12.99",
    whatKey: "checkoutPlanBundleWhat",
    cta: "pay",
    redirect: (auditId) => (auditId ? `/app/patient/results/${auditId}` : "/app/patient"),
  },
  "tier-starter": {
    id: "tier-starter",
    titleKey: "checkoutPlanTierStarterTitle",
    priceLabel: "$299/mo",
    whatKey: "checkoutPlanTierStarterWhat",
    cta: "pay",
    tier: "starter",
    redirect: () => "/app/employer",
  },
  "tier-growth": {
    id: "tier-growth",
    titleKey: "checkoutPlanTierGrowthTitle",
    priceLabel: "$799/mo",
    whatKey: "checkoutPlanTierGrowthWhat",
    cta: "pay",
    tier: "growth",
    redirect: () => "/app/employer",
  },
  "tier-enterprise": {
    id: "tier-enterprise",
    titleKey: "checkoutPlanTierEnterpriseTitle",
    priceLabel: "Custom",
    whatKey: "checkoutPlanTierEnterpriseWhat",
    cta: "contact",
    redirect: () => "/app/employer",
  },
};

function isPlanId(v: string | null): v is PlanId {
  return (
    v === "unlock" ||
    v === "letter" ||
    v === "bundle" ||
    v === "tier-starter" ||
    v === "tier-growth" ||
    v === "tier-enterprise"
  );
}

export default function Checkout() {
  const { t } = useLocale();
  const { user, unlockShortlist, unlockComplaint, unlockBundle, setEmployerTier } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);

  const planParam = params.get("plan");
  const auditId = params.get("audit") ?? undefined;
  const plan: PlanDef = useMemo(() => {
    if (planParam && isPlanId(planParam)) return PLANS[planParam];
    return PLANS.unlock;
  }, [planParam]);

  if (!user) {
    const here = `/checkout${planParam ? `?plan=${planParam}${auditId ? `&audit=${auditId}` : ""}` : ""}`;
    return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />;
  }

  function pay() {
    setBusy(true);
    window.setTimeout(() => {
      if (plan.id === "unlock" && auditId) unlockShortlist(auditId);
      else if (plan.id === "letter" && auditId) unlockComplaint(auditId);
      else if (plan.id === "bundle" && auditId) unlockBundle(auditId);
      else if (plan.tier) setEmployerTier(plan.tier);
      nav(plan.redirect(auditId), { replace: true });
    }, 450);
  }

  const isContact = plan.cta === "contact";

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-card__eyebrow">{t("checkoutEyebrow")}</div>
        <h1 className="auth-card__title">{t(plan.titleKey)}</h1>
        <p className="banner" style={{ marginBottom: "1rem" }}>
          {DEMO_LABEL}
        </p>

        <div className="order-summary">
          <div className="order-summary__row">
            <span>{t(plan.titleKey)}</span>
            <span className="mono-id">{plan.priceLabel}</span>
          </div>
          <div className="order-summary__row order-summary__row--total">
            <span>{t("checkoutTotal")}</span>
            <span className="mono-id">{plan.priceLabel}</span>
          </div>
        </div>

        <p className="lede" style={{ fontSize: "0.82rem", marginBottom: "1rem" }}>
          {t(plan.whatKey)}
        </p>

        {isContact ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <a className="btn full" href="mailto:sales@ghostnetworkbuster.example?subject=Enterprise%20pricing%20inquiry">
              {t("checkoutContactSales")}
            </a>
            <button
              type="button"
              className="btn secondary full"
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => {
                  setEmployerTier("starter");
                  nav("/app/employer", { replace: true });
                }, 350);
              }}
              disabled={busy}
            >
              {busy ? t("checkoutProcessing") : t("checkoutFallbackStarter")}
            </button>
          </div>
        ) : (
          <button type="button" className="btn full" onClick={pay} disabled={busy}>
            {busy ? t("checkoutProcessing") : t("checkoutPayLabel", { price: plan.priceLabel })}
          </button>
        )}
        <p className="auth-card__alt">
          <Link to={user.role === "employer" ? "/app/employer" : "/app/patient"}>
            {t("checkoutCancel")}
          </Link>
        </p>
      </div>
    </div>
  );
}
