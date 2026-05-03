import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiPost, apiProvidersPreview, type PlanType } from "../api";
import { disclaimerRecording, disclaimerShort } from "../copy";
import { PRESET_CARRIERS as CARRIER_LIST } from "../data/carriers";
import { DEMO_AUDIT_ID } from "../demo-data";
import { useLocale } from "../locale";

const CARE_OPTIONS = [
  "Anxiety", "Depression", "Trauma / PTSD", "ADHD",
  "Addiction", "Grief", "LGBTQ+ Affirming", "Spanish-speaking",
  "Sliding Scale", "Virtual Only", "In-Person",
];

/** NY-biased and common national carriers; "Other" triggers free-text. */
const PRESET_CARRIERS: string[] = [...CARRIER_LIST, "Other (type below)"];

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: "commercial", label: "Commercial / employer plan" },
  { value: "medicaid", label: "Medicaid / Essential Plan" },
  { value: "medicare", label: "Medicare" },
  { value: "employer", label: "Self-funded / employer-only ID card" },
  { value: "unsure", label: "Not sure" },
];

const DURATION_HINT = import.meta.env.VITE_AUDIT_DURATION_HINT ?? "~90 seconds for a typical sample";
const SEC_PER_CALL = Number(import.meta.env.VITE_AUDIT_SECONDS_PER_CALL ?? 3);

const OTHER_CARRIER = "Other (type below)";

function CrisisStrip() {
  const { t } = useLocale();
  return (
    <p className="crisis-strip" style={{ fontSize: "0.72rem", lineHeight: 1.6, color: "var(--muted)", marginBottom: "1rem" }}>
      {t("crisis988Short")}{" "}
      <a href="tel:988">988</a> ({t("crisis988")}) ·{" "}
      <a href="https://988lifeline.org/" rel="noopener noreferrer" target="_blank">{t("crisisLinks")}</a>
      {" · "}
      <a href="https://nycwell.cityofnewyork.us/" rel="noopener noreferrer" target="_blank">{t("crisisNyc")}</a>
    </p>
  );
}

export default function Landing() {
  const { t } = useLocale();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [carrierPick, setCarrierPick] = useState(() =>
    PRESET_CARRIERS.includes("Aetna") ? "Aetna" : PRESET_CARRIERS[0] ?? "Aetna",
  );
  const [carrierOther, setCarrierOther] = useState("");
  const [planType, setPlanType] = useState<PlanType>("unsure");
  const [memberPlanLabel, setMemberPlanLabel] = useState("");
  const [zip, setZip] = useState("10001");
  const [needs, setNeeds] = useState<string[]>(["Anxiety", "Trauma / PTSD"]);
  const [busy, setBusy] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [consentRecord, setConsentRecord] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [zipTouched, setZipTouched] = useState(false);

  const termsUrl = import.meta.env.VITE_TERMS_URL?.trim();
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL?.trim();

  const zipOk = /^\d{5}(-\d{4})?$/.test(zip.trim());
  const showZipErr = zipTouched && !zipOk;

  useEffect(() => {
    if (searchParams.get("demo") === "true") {
      nav(`/app/patient/audits/${DEMO_AUDIT_ID}`);
    }
  }, [searchParams, nav]);

  useEffect(() => {
    let cancelled = false;
    void apiProvidersPreview(null)
      .then((p) => {
        if (!cancelled) {
          setPreviewCount(p.count);
          setPreviewErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          if (e instanceof ApiError && e.status === 401) {
            setPreviewErr("Could not load directory size — invalid or missing API key.");
          } else {
            setPreviewErr(e instanceof Error ? e.message : "Preview failed");
          }
          setPreviewCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerLabel = useMemo(() => {
    if (previewErr) return "…";
    if (previewCount == null) return "…";
    return String(previewCount);
  }, [previewCount, previewErr]);

  const estSeconds = useMemo(() => {
    if (previewCount == null || previewErr) return null;
    return Math.max(60, Math.round(previewCount * SEC_PER_CALL));
  }, [previewCount, previewErr]);

  const resolvedCarrier = useMemo(() => {
    if (carrierPick === OTHER_CARRIER) return carrierOther.trim() || "Other";
    return carrierPick;
  }, [carrierPick, carrierOther]);

  const toggle = (n: string) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  async function start() {
    setErr(null);
    setZipTouched(true);
    if (!zipOk) {
      setErr(t("landingZipErr"));
      return;
    }
    if (!consentRecord || !consentTerms) {
      setErr(t("landingConsentRequired"));
      return;
    }
    if (carrierPick === OTHER_CARRIER && !carrierOther.trim()) {
      setErr(t("landingOtherCarrierRequired"));
      return;
    }
    setBusy(true);
    setInitiating(true);
    try {
      const { audit_id } = await apiPost<{ audit_id: string }>("/api/start-audit", {
        carrier: resolvedCarrier,
        zip_code: zip.trim(),
        care_needs: needs,
        plan_type: planType,
        member_plan_label: memberPlanLabel.trim() || null,
        recording_consent: consentRecord,
        terms_acknowledged: consentTerms,
      });
      await new Promise((r) => setTimeout(r, 500));
      nav(`/app/patient/audits/${audit_id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setErr(t("authErrorBody"));
        else setErr(e.message);
      } else {
        setErr(e instanceof Error ? e.message : "Could not start audit");
      }
      setBusy(false);
      setInitiating(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: "2rem" }} className="print-hidden">
      <div style={{ marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)" }}>
          Columbia University · Agentic AI · May 2026
        </span>
      </div>

      <h1 style={{ marginBottom: "0.5rem" }}>GHOST NETWORK<br />BUSTER</h1>
      <p className="lede">
        {previewCount != null && !previewErr
          ? t("landingSubtitleWithCount", { count: previewCount })
          : t("landingSubtitleGeneric")}
      </p>

      <details className="why-details" style={{ marginBottom: "1.5rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.75rem", color: "var(--muted)", letterSpacing: "0.06em" }}>
          {t("landingWhyExists")}
        </summary>
        <div className="redacted-quote" style={{ marginTop: "0.75rem" }}>
          <span className="redact">████</span>{" "}
          &quot;I made 21 calls. I never found a therapist. My son is dead.&quot;
          <cite>
            — Barbara Coutinho, whose son Ravi died after his insurer&apos;s ghost network denied him care.
            ProPublica / Fierce Healthcare, 2025.
          </cite>
        </div>
      </details>

      <CrisisStrip />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>{t("landingStart")}</h2>

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="carrier">{t("landingCarrier")}</label>
          <select
            id="carrier"
            value={carrierPick}
            onChange={(e) => setCarrierPick(e.target.value)}
          >
            {PRESET_CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {carrierPick === OTHER_CARRIER ? (
          <div style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="carrierOther">{t("landingCarrierOther")}</label>
            <input
              id="carrierOther"
              value={carrierOther}
              onChange={(e) => setCarrierOther(e.target.value)}
              placeholder="e.g., regional Medicaid plan"
              autoComplete="organization"
            />
          </div>
        ) : null}

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="planType">{t("landingPlanType")}</label>
          <select
            id="planType"
            value={planType}
            onChange={(e) => setPlanType(e.target.value as PlanType)}
          >
            {PLAN_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="memberPlan">{t("landingMemberPlan")}</label>
          <input
            id="memberPlan"
            value={memberPlanLabel}
            onChange={(e) => setMemberPlanLabel(e.target.value)}
            maxLength={200}
            placeholder='e.g., "Gold PPO" — optional'
          />
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="zip">{t("landingZip")}</label>
          <input
            id="zip"
            className="mono-id"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            onBlur={() => setZipTouched(true)}
            maxLength={12}
            aria-invalid={showZipErr}
            aria-describedby={showZipErr ? "zip-err" : undefined}
          />
          {showZipErr ? (
            <p id="zip-err" className="err" style={{ marginTop: "0.35rem", marginBottom: 0, fontSize: "0.72rem" }}>
              {t("landingZipErr")}
            </p>
          ) : (
            <p style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: "0.35rem", marginBottom: 0 }}>
              {t("landingZipHint")}
            </p>
          )}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>{t("landingCareNeeds")}</label>
          <div className="chips">
            {CARE_OPTIONS.map((c) => (
              <button type="button" key={c} className={`chip ${needs.includes(c) ? "on" : ""}`} onClick={() => toggle(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div
          className="expectations-block"
          style={{
            fontSize: "0.72rem",
            color: "var(--muted)",
            lineHeight: 1.65,
            marginBottom: "1rem",
            padding: "0.65rem 0.85rem",
            border: "1px solid var(--border)",
            borderRadius: 3,
            background: "var(--bg)",
          }}
        >
          <strong style={{ color: "var(--text)", letterSpacing: "0.06em", fontSize: "0.65rem" }}>{t("landingExpectTitle")}</strong>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
            <li>{t("landingExpectParallel")}</li>
            <li>
              {estSeconds != null
                ? t("landingExpectDuration", { sec: estSeconds, count: previewCount ?? 0 })
                : t("landingExpectDurationFallback", { hint: DURATION_HINT })}
            </li>
            <li>{t("landingExpectOutcome")}</li>
          </ul>
        </div>

        <label className="consent-row" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.65rem", fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={consentRecord}
            onChange={(e) => setConsentRecord(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          <span>
            {disclaimerRecording}{" "}
            {termsUrl ? (
              <a

                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("landingConsentCalls")}
              </a>
            ) : (
              <Link to="/terms">{t("landingConsentCalls")}</Link>
            )}
            .
          </span>
        </label>
        <label className="consent-row" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.85rem", fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={consentTerms}
            onChange={(e) => setConsentTerms(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          <span>
            {disclaimerShort}{" "}
            {privacyUrl ? (
              <a href={privacyUrl} target="_blank" rel="noopener noreferrer">{t("landingConsentPrivacy")}</a>
            ) : (
              <Link to="/privacy">{t("landingConsentPrivacy")}</Link>
            )}
            .
          </span>
        </label>

        {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}

        <button
          type="button"
          className={`btn full${!busy ? " cta" : ""}`}
          disabled={busy}
          onClick={() => void start()}
          style={{ fontSize: "0.85rem", padding: "0.85rem" }}
        >
          {initiating ? t("landingStarting", { count: providerLabel }) : t("landingStartBtn", { count: providerLabel })}
        </button>

        <button
          type="button"
          className="btn full secondary"
          disabled={busy}
          onClick={() => nav(`/app/patient/audits/${DEMO_AUDIT_ID}`)}
          style={{ fontSize: "0.75rem", padding: "0.6rem", marginTop: "0.5rem" }}
        >
          {t("landingDemo")}
        </button>
      </div>

      <p style={{ fontSize: "0.68rem", color: "var(--muted)", lineHeight: 1.8, textAlign: "center" }}>
        {t("landingFooter")}{" "}
        {previewCount != null ? t("landingFooterCount", { count: previewCount }) : t("landingFooterSize")}
        <br />
        {t("landingFooterRetention")}
      </p>
    </div>
  );
}
