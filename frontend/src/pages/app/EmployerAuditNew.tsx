import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, apiPost, type PlanType } from "../../api";
import { useAuth } from "../../auth/AuthProvider";
import { PRESET_CARRIERS } from "../../data/carriers";
import { saveBatch, type BatchAuditChild } from "../../data/employerBatches";
import { useLocale } from "../../locale";

const CARE_OPTIONS = [
  "Anxiety", "Depression", "Trauma / PTSD", "ADHD",
  "Addiction", "Grief", "LGBTQ+ Affirming", "Sliding Scale",
];

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: "commercial", label: "Commercial / employer plan" },
  { value: "medicaid", label: "Medicaid / Essential Plan" },
  { value: "medicare", label: "Medicare / Medicare Advantage" },
  { value: "employer", label: "Self-funded employer (ERISA)" },
  { value: "unsure", label: "Mixed / unsure" },
];

const HARD_CAP = 10;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

function parseZips(raw: string): string[] {
  return raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `batch-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

export default function EmployerAuditNew() {
  const { t } = useLocale();
  const nav = useNavigate();
  const { employerTier } = useAuth();

  const [carriers, setCarriers] = useState<string[]>(["Aetna", "UnitedHealthcare"]);
  const [zipsRaw, setZipsRaw] = useState<string>("10001\n11201");
  const [planType, setPlanType] = useState<PlanType>("employer");
  const [needs, setNeeds] = useState<string[]>(["Anxiety", "Depression"]);
  const [consentRecord, setConsentRecord] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const zips = useMemo(() => parseZips(zipsRaw), [zipsRaw]);
  const invalidZips = useMemo(() => zips.filter((z) => !ZIP_RE.test(z)), [zips]);

  if (employerTier === null) {
    return <Navigate to="/checkout?plan=tier-starter" replace />;
  }

  const totalPairs = carriers.length * zips.length;
  const exceedsCap = totalPairs > HARD_CAP;
  const canSubmit =
    carriers.length > 0 &&
    zips.length > 0 &&
    invalidZips.length === 0 &&
    !exceedsCap &&
    consentRecord &&
    consentTerms &&
    !submitting;

  function toggleCarrier(c: string) {
    setCarriers((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleNeed(n: string) {
    setNeeds((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);

    const pairs: { carrier: string; zip: string }[] = [];
    for (const c of carriers) for (const z of zips) pairs.push({ carrier: c, zip: z });

    const results = await Promise.allSettled(
      pairs.map(({ carrier, zip }) =>
        apiPost<{ audit_id: string }>("/api/start-audit", {
          carrier,
          zip_code: zip,
          care_needs: needs,
          plan_type: planType,
          recording_consent: consentRecord,
          terms_acknowledged: consentTerms,
        }).then((r) => ({ id: r.audit_id, carrier, zip })),
      ),
    );

    const audits: BatchAuditChild[] = [];
    let firstErr: string | null = null;
    for (const r of results) {
      if (r.status === "fulfilled") audits.push(r.value);
      else if (!firstErr)
        firstErr = r.reason instanceof ApiError ? r.reason.message : String(r.reason);
    }

    if (audits.length === 0) {
      setSubmitting(false);
      setErr(firstErr ?? t("employerFormSubmitError"));
      return;
    }

    const batchId = genId();
    saveBatch({
      id: batchId,
      createdAt: new Date().toISOString(),
      carriers,
      zips,
      audits,
      status: "running",
    });

    nav(`/app/employer/batches/${batchId}`);
  }

  return (
    <div className="employer-audit-new">
      <header style={{ marginBottom: "1.25rem" }}>
        <div className="hero__eyebrow">{t("employerNewAuditEyebrow")}</div>
        <h1 className="patient-home__title">{t("employerNewAuditTitle")}</h1>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("employerNewAuditLede")}
        </p>
        <div className="banner" style={{ marginTop: "0.75rem" }}>
          {t("employerTierBadge", { tier: employerTier })}
          {" · "}
          <Link to="/pricing">{t("employerChangePlan")}</Link>
        </div>
      </header>

      <form className="card" onSubmit={submit}>
        <fieldset style={{ marginBottom: "1.25rem" }}>
          <legend className="auth-card__field-label">
            {t("employerFormCarriersLabel")}
          </legend>
          <div className="chips">
            {PRESET_CARRIERS.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip${carriers.includes(c) ? " on" : ""}`}
                onClick={() => toggleCarrier(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ marginBottom: "1.25rem" }}>
          <legend className="auth-card__field-label">
            <label htmlFor="zips">{t("employerFormZipsLabel")}</label>
          </legend>
          <textarea
            id="zips"
            value={zipsRaw}
            onChange={(e) => setZipsRaw(e.target.value)}
            rows={4}
            placeholder="10001, 11201, 10463"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
          />
          <p className="lede" style={{ fontSize: "0.78rem", marginTop: "0.4rem" }}>
            {t("employerFormZipsHelp")}
          </p>
          {invalidZips.length > 0 ? (
            <p className="err" style={{ marginTop: "0.5rem" }}>
              {t("employerFormInvalidZips", { list: invalidZips.join(", ") })}
            </p>
          ) : null}
        </fieldset>

        <fieldset style={{ marginBottom: "1.25rem" }}>
          <legend className="auth-card__field-label">
            {t("employerFormNeedsLabel")}
          </legend>
          <div className="chips">
            {CARE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${needs.includes(n) ? " on" : ""}`}
                onClick={() => toggleNeed(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ marginBottom: "1.25rem" }}>
          <legend className="auth-card__field-label">
            <label htmlFor="plan-type">{t("employerFormPlanTypeLabel")}</label>
          </legend>
          <select
            id="plan-type"
            value={planType}
            onChange={(e) => setPlanType(e.target.value as PlanType)}
          >
            {PLAN_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
        </fieldset>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={consentRecord}
              onChange={(e) => setConsentRecord(e.target.checked)}
            />
            <span>{t("employerFormConsentRecord")}</span>
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "0.5rem" }}>
            <input
              type="checkbox"
              checked={consentTerms}
              onChange={(e) => setConsentTerms(e.target.checked)}
            />
            <span>{t("employerFormConsentTerms")}</span>
          </label>
        </div>

        <div className="banner" style={{ marginBottom: "1rem" }}>
          {t("employerFormSummary", {
            carriers: carriers.length,
            zips: zips.length,
            total: totalPairs,
          })}
        </div>

        {exceedsCap ? (
          <p className="err" style={{ marginBottom: "0.75rem" }}>
            {t("employerFormCapWarning", { cap: HARD_CAP, total: totalPairs })}
          </p>
        ) : null}
        {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" className="btn" disabled={!canSubmit}>
            {submitting ? t("employerFormSubmitting") : t("employerFormSubmit")}
          </button>
          <Link to="/app/employer" className="btn secondary">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
