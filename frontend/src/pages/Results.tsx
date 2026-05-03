import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AuditSummary, CallResult } from "../api";
import { ApiError, apiGet, downloadPdf } from "../api";
import StatusLegend from "../components/StatusLegend";
import { DEMO_AUDIT_ID, DEMO_SUMMARY } from "../demo-data";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLocale } from "../locale";
import { ghostReasonLabelLong } from "../labels";

function formatVerifiedAt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function Results() {
  const { t } = useLocale();
  const { auditId } = useParams();
  const isDemo = auditId === DEMO_AUDIT_ID;
  const [summary, setSummary] = useState<AuditSummary | null>(isDemo ? DEMO_SUMMARY : null);
  const [loadErr, setLoadErr] = useState<{ status?: number; message: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [shareGate, setShareGate] = useState(false);

  const closeShare = useCallback(() => setShareGate(false), []);
  const shareTrapRef = useFocusTrap(shareGate, closeShare);

  useEffect(() => {
    if (!auditId || isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await apiGet<AuditSummary>(`/api/summary/${auditId}`);
        if (!cancelled) {
          setSummary(s);
          setLoadErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) {
            setLoadErr({ status: e.status, message: e.message });
          } else {
            setLoadErr({
              status: undefined,
              message: e instanceof Error ? e.message : "Load failed",
            });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auditId, isDemo]);

  async function copyShare() {
    await navigator.clipboard.writeText(`${window.location.origin}/results/${auditId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function grab(path: string, filename: string, key: string) {
    setDownloading(key);
    try {
      await downloadPdf(path, filename);
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadErr({ status: e.status, message: e.message });
      }
    } finally {
      setDownloading(null);
    }
  }

  if (!auditId) return <p className="err">{t("genericErrorTitle")}</p>;

  if (loadErr && !summary) {
    const title =
      loadErr.status === 410
        ? t("linkExpiredTitle")
        : loadErr.status === 401
          ? t("authErrorTitle")
          : t("genericErrorTitle");
    const body =
      loadErr.status === 410
        ? t("linkExpiredBody")
        : loadErr.status === 401
          ? t("authErrorBody")
          : loadErr.message || t("genericErrorBody");
    return (
      <div className="results-page" role="alert">
        <h1>{title}</h1>
        <p className="lede">{body}</p>
        <Link to="/" className="btn secondary print-hidden">
          {t("newAudit")}
        </Link>
      </div>
    );
  }

  if (!summary) return <p className="lede">{t("loadingResults")}</p>;

  const ghostPct = (summary.ghost_rate * 100).toFixed(1);
  const isHigh = summary.high_ghost_rate;
  const zeroCompleted = summary.real_count === 0 && summary.status === "completed";

  let headline: string;
  if (summary.status === "completed" && summary.real_count === 0) {
    headline = t("resultsH1Zero", { total: summary.providers_total });
  } else if (summary.high_ghost_rate && summary.real_count > 0) {
    headline = t("resultsH1HighGhost", { n: summary.real_count, total: summary.providers_total });
  } else {
    headline = t("resultsH1Usable", { n: summary.real_count, total: summary.providers_total });
  }

  const planPart =
    summary.plan_type && summary.plan_type !== "unsure"
      ? t("planTypePrefix", { type: summary.plan_type })
      : "";
  const cardPart = summary.member_plan_label?.trim()
    ? t("memberCardPrefix", { label: summary.member_plan_label.trim() })
    : "";
  const verifyNote = t("verifyContextNote", { carrier: summary.carrier, plan: planPart, card: cardPart });

  const ledePieces: string[] = [];
  if (summary.high_ghost_rate && summary.real_count > 0) {
    ledePieces.push(t("resultsLedeMixed"));
  }
  if (summary.completed_at) {
    ledePieces.push(`Completed (UTC reference): ${summary.completed_at}.`);
  }
  if (summary.care_needs.length) {
    ledePieces.push(`Care needs asked about: ${summary.care_needs.join(", ")}.`);
  }
  ledePieces.push(verifyNote);

  const breakdown: Record<string, number> = {};
  for (const r of summary.results) {
    if (r.status === "ghost" && r.ghost_reason) {
      breakdown[r.ghost_reason] = (breakdown[r.ghost_reason] ?? 0) + 1;
    }
  }
  const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="results-page">
      {shareGate ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
          <div ref={shareTrapRef} className="modal-panel card">
            <h2 id="share-modal-title" style={{ marginBottom: "0.75rem" }}>
              {t("shareModalTitle")}
            </h2>
            <p className="lede" style={{ marginBottom: "1rem" }}>
              {t("shareModalBody")}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" className="btn secondary" onClick={closeShare}>
                {t("shareModalCancel")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  closeShare();
                  void copyShare();
                }}
              >
                {t("shareModalCopy")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loadErr ? (
        <p className="err print-hidden" style={{ marginBottom: "0.75rem" }}>
          {loadErr.message}
        </p>
      ) : null}

      <div className="results-section">
        <div className="crisis-band print-hidden">
          <div className="crisis-band__title">{t("noticesTitle")}</div>
          <p className="crisis-band__body">
            {t("crisis988Short")}{" "}
            <a href="tel:988">988</a>
            {" · "}
            <a href="https://988lifeline.org/" rel="noopener noreferrer" target="_blank">
              {t("crisisLinks")}
            </a>
            {" · "}
            <a href="https://nycwell.cityofnewyork.us/" rel="noopener noreferrer" target="_blank">
              {t("crisisNyc")}
            </a>
            {". "}
            {t("noticesShareOnly")}
          </p>
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: "0.4rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {t("resultsMetaComplete")} · {summary.carrier} ·{" "}
            <span className="mono-id">
              ZIP {summary.zip_code}
            </span>
            {isDemo && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "var(--font-mono)",
                  background: "var(--amber-dim)",
                  color: "var(--text)",
                  padding: "0.15rem 0.45rem",
                  borderRadius: 2,
                  letterSpacing: "0.1em",
                }}
              >
                DEMO
              </span>
            )}
          </div>
          <h1>{headline}</h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            {ledePieces.join(" ")}
          </p>
        </div>
      </div>

      <div className="results-section">
        <div className="kpi-row" style={{ marginBottom: "1rem" }}>
        <div className="kpi ghost-kpi">
          <div className="val">{ghostPct}%</div>
          <div className="lbl">Ghost rate</div>
        </div>
        <div className="kpi real-kpi">
          <div className="val">{summary.real_count}</div>
          <div className="lbl">Real / usable</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.voicemail_count}</div>
          <div className="lbl">Voicemail</div>
        </div>
        <div className="kpi">
          <div className="val">{summary.calls_completed}</div>
          <div className="lbl">Calls placed</div>
        </div>
      </div>

      <StatusLegend compact />

      {zeroCompleted ? (
        <div
          className="card"
          style={{
            marginBottom: "1.5rem",
            borderColor: "rgba(255,184,0,0.35)",
            background: "linear-gradient(135deg, rgba(61,45,0,0.35) 0%, var(--surface) 100%)",
          }}
        >
          <h2 style={{ color: "var(--text)", marginBottom: "0.65rem" }}>{t("zeroResultsTitle")}</h2>
          <p className="lede" style={{ marginBottom: 0, maxWidth: "62ch" }}>
            {t("zeroResultsBody")}
          </p>
        </div>
      ) : null}

      {isHigh && (
        <div className="alert-bar" style={{ marginBottom: "1.5rem" }}>
          <span className="alert-icon" aria-hidden />
          <span style={{ flex: 1 }}>{t("regulatoryAlert")}</span>
          {summary.complaint_eligible ? (
            <button
              type="button"
              className="btn print-hidden"
              style={{ flexShrink: 0, fontSize: "0.72rem" }}
              disabled={downloading === "complaint"}
              onClick={() =>
                void grab(`/api/download/complaint/${auditId}`, `gnb-complaint-${auditId!.slice(0, 8)}.docx`, "complaint")
              }
            >
              {downloading === "complaint" ? t("complaintGenerating") : t("resultsComplaintDraft")}
            </button>
          ) : null}
        </div>
      )}

      </div>

      <div className="results-section">
        <h2 style={{ marginBottom: "1rem" }}>{t("shortlistHeading")}</h2>
        {summary.top_providers.length === 0 ? (
          <p className="lede">{t("shortlistEmpty")}</p>
        ) : (
          summary.top_providers.map((p: CallResult) => (
          <div key={p.npi} className="provider-card verified">
            <div className="verified-badge">
              {t("resultsUsableBadge", { when: formatVerifiedAt(p.verified_at) })}
            </div>
            <h3>{p.provider_name || p.npi}</h3>
            {p.specialty && <div className="detail">● Specialty: {p.specialty}</div>}
            <div className="detail highlight">
              ● Per call: aligned with {summary.carrier} inquiry (confirm member ID before booking).
            </div>
            <div className="detail highlight">
              ● Per call: accepting new patients as described in transcript (always re-verify).
            </div>
            {p.summary && (
              <div className="detail" style={{ marginTop: "0.5rem", fontStyle: "italic" }}>
                {p.summary}
              </div>
            )}
            <div className="print-hidden" style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" onClick={() => setOpen(open === p.npi ? null : p.npi)}>
                {open === p.npi ? t("resultsHideTranscript") : t("resultsViewTranscript")}
              </button>
              {p.phone ? (
                <span className="detail">
                  {t("resultsPhoneOnFile")} {p.phone}
                </span>
              ) : null}
            </div>
            {open === p.npi && <pre className="mono" style={{ marginTop: "0.65rem" }}>{p.transcript}</pre>}
          </div>
          ))
        )}
      </div>

      <div className="results-section">
        <div className="card print-hidden" style={{ marginBottom: 0 }}>
        <h2>{t("downloadsHeading")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn secondary" onClick={() => setShareGate(true)}>
            {copied ? t("shareModalCopied") : t("copyShareButton")}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={downloading === "pdf"}
            onClick={() => void grab(`/api/download/summary/${auditId}`, `gnb-audit-${auditId!.slice(0, 8)}.pdf`, "pdf")}
          >
            {downloading === "pdf" ? t("resultsDownloading") : t("downloadPdf")}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={downloading === "csv"}
            onClick={() => void grab(`/api/download/csv/${auditId}`, `gnb-audit-${auditId!.slice(0, 8)}.csv`, "csv")}
          >
            {downloading === "csv" ? t("resultsDownloading") : t("downloadCsv")}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!summary.complaint_eligible || downloading === "complaint"}
            title={summary.complaint_eligible ? "" : "Requires at least one ghost (failed) listing"}
            onClick={() => void grab(`/api/download/complaint/${auditId}`, `gnb-complaint-${auditId!.slice(0, 8)}.docx`, "complaint")}
          >
            {downloading === "complaint" ? t("complaintGenerating") : t("downloadComplaint")}
          </button>
        </div>
      </div>
      </div>

      {breakdownEntries.length > 0 ? (
        <div className="results-section">
          <div className="card" style={{ marginBottom: 0 }}>
            <h2>{t("resultsGhostBreakdown")}</h2>
            {breakdownEntries.map(([reason, count]) => (
              <div key={reason} className="bar-row">
                <div className="lbl">{ghostReasonLabelLong(reason)}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(100, (count / Math.max(summary.ghost_count, 1)) * 100)}%` }}
                  />
                </div>
                <div className="count">{count}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="results-section results-section--tail">
        <h2 style={{ marginBottom: "0.75rem" }}>{t("allCallsHeading")}</h2>
        <div className="tile-grid" style={{ marginBottom: "1.25rem" }}>
          {summary.results.map((row) => (
            <div
              key={`${row.npi}-${row.verified_at}`}
              className={`tile ${row.status === "real" ? "real" : row.status === "ghost" ? "ghost" : "voicemail"}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
                <span className="name">{row.provider_name || row.npi}</span>
                <span className={`pill ${row.status === "real" ? "real" : row.status === "ghost" ? "ghost" : "voicemail"}`}>
                  {row.status}
                </span>
              </div>
              {row.ghost_reason && <div className="meta">{ghostReasonLabelLong(row.ghost_reason)}</div>}
              {row.summary && !row.ghost_reason && <div className="meta">{row.summary.slice(0, 55)}</div>}
            </div>
          ))}
        </div>

        <Link to="/" className="print-hidden" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {t("newAudit")}
        </Link>
      </div>
    </div>
  );
}
