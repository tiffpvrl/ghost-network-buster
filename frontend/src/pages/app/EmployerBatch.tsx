import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiGet, type AuditSummary } from "../../api";
import {
  loadBatch,
  updateBatchStatus,
  type EmployerBatch,
} from "../../data/employerBatches";
import { useLocale } from "../../locale";

type ChildSummary = AuditSummary | { audit_id: string; status: "pending" | "error"; error?: string };

function isFullSummary(v: ChildSummary): v is AuditSummary {
  return v.status === "running" || v.status === "completed" || v.status === "failed";
}

export default function EmployerBatchPage() {
  const { t } = useLocale();
  const { batchId } = useParams();
  const [batch, setBatch] = useState<EmployerBatch | null>(() =>
    batchId ? loadBatch(batchId) : null,
  );
  const [summaries, setSummaries] = useState<Record<string, ChildSummary>>({});
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!batchId) return;
    const b = loadBatch(batchId);
    setBatch(b);
  }, [batchId]);

  // Poll each child every ~1s until all completed/failed.
  useEffect(() => {
    if (!batch) return;
    stoppedRef.current = false;
    let timer: number | null = null;

    const tick = async () => {
      if (stoppedRef.current) return;
      const next: Record<string, ChildSummary> = { ...summaries };
      for (const child of batch.audits) {
        const cur = next[child.id];
        if (cur && isFullSummary(cur) && (cur.status === "completed" || cur.status === "failed")) {
          continue;
        }
        try {
          const s = await apiGet<AuditSummary>(`/api/summary/${child.id}`);
          next[child.id] = s;
        } catch (e) {
          next[child.id] = {
            audit_id: child.id,
            status: "error",
            error: e instanceof ApiError ? e.message : String(e),
          };
        }
      }
      if (stoppedRef.current) return;
      setSummaries(next);

      const allDone = batch.audits.every((c) => {
        const s = next[c.id];
        if (!s) return false;
        if (!isFullSummary(s)) return false;
        return s.status === "completed" || s.status === "failed";
      });
      if (allDone) {
        updateBatchStatus(batch.id, "completed");
        return;
      }
      timer = window.setTimeout(() => void tick(), 1000);
    };

    void tick();

    return () => {
      stoppedRef.current = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  const aggregates = useMemo(() => {
    if (!batch) return null;
    let totalCallsCompleted = 0;
    let totalProviders = 0;
    let totalGhost = 0;
    let totalReal = 0;
    let completedCount = 0;
    for (const child of batch.audits) {
      const s = summaries[child.id];
      if (s && isFullSummary(s)) {
        totalCallsCompleted += s.calls_completed;
        totalProviders += s.providers_total;
        totalGhost += s.ghost_count;
        totalReal += s.real_count;
        if (s.status === "completed" || s.status === "failed") completedCount += 1;
      }
    }
    const ghostPct = totalCallsCompleted > 0 ? (totalGhost / totalCallsCompleted) * 100 : 0;
    return {
      totalAudits: batch.audits.length,
      completedCount,
      totalCallsCompleted,
      totalProviders,
      totalGhost,
      totalReal,
      ghostPct,
    };
  }, [batch, summaries]);

  if (!batchId || !batch) {
    return (
      <div className="results-page" role="alert">
        <h1>{t("batchMissingTitle")}</h1>
        <p className="lede">{t("batchMissingBody")}</p>
        <Link to="/app/employer" className="btn secondary">
          {t("batchBackToEmployer")}
        </Link>
      </div>
    );
  }

  return (
    <div className="employer-batch">
      <header style={{ marginBottom: "1rem" }}>
        <div className="hero__eyebrow">{t("batchEyebrow")}</div>
        <h1 className="patient-home__title">
          {t("batchTitle", { id: batch.id.slice(0, 8) })}
        </h1>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("batchLede", {
            carriers: batch.carriers.length,
            zips: batch.zips.length,
            total: batch.audits.length,
          })}
        </p>
      </header>

      {aggregates ? (
        <div className="kpi-row" style={{ marginBottom: "1.25rem" }}>
          <div className="kpi">
            <div className="val">{aggregates.completedCount}/{aggregates.totalAudits}</div>
            <div className="lbl">{t("batchKpiAudits")}</div>
          </div>
          <div className="kpi ghost-kpi">
            <div className="val">{aggregates.ghostPct.toFixed(1)}%</div>
            <div className="lbl">{t("batchKpiGhostRate")}</div>
          </div>
          <div className="kpi real-kpi">
            <div className="val">{aggregates.totalReal}</div>
            <div className="lbl">{t("batchKpiReal")}</div>
          </div>
          <div className="kpi">
            <div className="val">{aggregates.totalCallsCompleted}</div>
            <div className="lbl">{t("batchKpiCallsPlaced")}</div>
          </div>
        </div>
      ) : null}

      <table className="batch-table">
        <thead>
          <tr>
            <th>{t("batchColCarrier")}</th>
            <th>{t("batchColZip")}</th>
            <th>{t("batchColCalls")}</th>
            <th>{t("batchColGhost")}</th>
            <th>{t("batchColStatus")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {batch.audits.map((child) => {
            const s = summaries[child.id];
            const callsLabel =
              s && isFullSummary(s)
                ? `${s.calls_completed}/${s.providers_total}`
                : "—";
            const ghostLabel =
              s && isFullSummary(s) && s.calls_completed > 0
                ? `${(s.ghost_rate * 100).toFixed(1)}%`
                : "—";
            const status = s && isFullSummary(s) ? s.status : s ? s.status : "pending";
            const isLive = status === "running" || status === "pending";
            const detailHref = isLive
              ? `/app/employer/audits/${child.id}`
              : `/app/employer/results/${child.id}`;
            return (
              <tr key={child.id}>
                <td>{child.carrier}</td>
                <td className="mono-id">{child.zip}</td>
                <td className="mono-id">{callsLabel}</td>
                <td className="mono-id">{ghostLabel}</td>
                <td>
                  <span className={`pill ${status === "completed" ? "real" : status === "failed" ? "ghost" : "voicemail"}`}>
                    {status}
                  </span>
                </td>
                <td>
                  <Link to={detailHref}>
                    {isLive ? t("batchRowLive") : t("batchRowOpen")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
