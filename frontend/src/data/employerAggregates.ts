// Aggregator for the employer "Network health" view and the renewal report PDF.
// Pure function — reads localStorage via existing helpers and folds simulated
// audit summaries into per-carrier / per-ZIP / per-care-need rollups.

import type { AuditSummary } from "../api";
import { listByCreatedAt as listBatches } from "./employerBatches";
import { getSimSummary, isSimAuditId } from "./employerSim";

type CarrierRow = {
  carrier: string;
  ghostRate: number; // 0..1
  calls: number;
  ghostCount: number;
  realCount: number;
  audits: number;
};

type ZipRow = {
  zip: string;
  realCount: number;
  ghostCount: number;
  audits: number;
};

type NeedRow = {
  need: string;
  auditsWithNeed: number;
  realInThoseAudits: number;
  ghostInThoseAudits: number;
};

export type EmployerAggregates = {
  totals: {
    batches: number;
    audits: number;
    auditsRunning: number;
    callsCompleted: number;
    providersTotal: number;
    ghostCount: number;
    realCount: number;
    voicemailCount: number;
    ghostRate: number; // 0..1
  };
  byCarrier: CarrierRow[];
  byZip: ZipRow[];
  byNeed: NeedRow[];
  brokenSpecialties: { need: string; auditsWithNeed: number }[];
  generatedAt: string;
};

function emptyAggregates(): EmployerAggregates {
  return {
    totals: {
      batches: 0,
      audits: 0,
      auditsRunning: 0,
      callsCompleted: 0,
      providersTotal: 0,
      ghostCount: 0,
      realCount: 0,
      voicemailCount: 0,
      ghostRate: 0,
    },
    byCarrier: [],
    byZip: [],
    byNeed: [],
    brokenSpecialties: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Walk every employer batch in localStorage, resolve child summaries via the
 * client-side simulator, and produce a deterministic aggregate snapshot.
 */
export function loadEmployerAggregates(): EmployerAggregates {
  const batches = listBatches();
  if (batches.length === 0) return emptyAggregates();

  const carriers = new Map<string, CarrierRow>();
  const zips = new Map<string, ZipRow>();
  const needs = new Map<string, NeedRow>();

  let totalAudits = 0;
  let auditsRunning = 0;
  let callsCompleted = 0;
  let providersTotal = 0;
  let ghostCount = 0;
  let realCount = 0;
  let voicemailCount = 0;

  for (const batch of batches) {
    for (const child of batch.audits) {
      if (!isSimAuditId(child.id)) continue;
      const s: AuditSummary | null = getSimSummary(child.id);
      if (!s) continue;

      totalAudits += 1;
      if (s.status === "running") auditsRunning += 1;
      callsCompleted += s.calls_completed;
      providersTotal += s.providers_total;
      ghostCount += s.ghost_count;
      realCount += s.real_count;
      voicemailCount += s.voicemail_count;

      const carrierRow =
        carriers.get(s.carrier) ?? {
          carrier: s.carrier,
          ghostRate: 0,
          calls: 0,
          ghostCount: 0,
          realCount: 0,
          audits: 0,
        };
      carrierRow.calls += s.calls_completed;
      carrierRow.ghostCount += s.ghost_count;
      carrierRow.realCount += s.real_count;
      carrierRow.audits += 1;
      carriers.set(s.carrier, carrierRow);

      const zipRow =
        zips.get(s.zip_code) ?? {
          zip: s.zip_code,
          realCount: 0,
          ghostCount: 0,
          audits: 0,
        };
      zipRow.realCount += s.real_count;
      zipRow.ghostCount += s.ghost_count;
      zipRow.audits += 1;
      zips.set(s.zip_code, zipRow);

      for (const n of s.care_needs ?? []) {
        const row =
          needs.get(n) ?? {
            need: n,
            auditsWithNeed: 0,
            realInThoseAudits: 0,
            ghostInThoseAudits: 0,
          };
        row.auditsWithNeed += 1;
        row.realInThoseAudits += s.real_count;
        row.ghostInThoseAudits += s.ghost_count;
        needs.set(n, row);
      }
    }
  }

  for (const row of carriers.values()) {
    row.ghostRate = row.calls > 0 ? row.ghostCount / row.calls : 0;
  }

  const byCarrier = [...carriers.values()].sort((a, b) => b.ghostRate - a.ghostRate);
  const byZip = [...zips.values()].sort((a, b) => a.realCount - b.realCount);
  const byNeed = [...needs.values()].sort(
    (a, b) => b.auditsWithNeed - a.auditsWithNeed,
  );
  const brokenSpecialties = byNeed
    .filter((n) => n.auditsWithNeed > 0 && n.realInThoseAudits === 0)
    .map((n) => ({ need: n.need, auditsWithNeed: n.auditsWithNeed }));

  const ghostRate = callsCompleted > 0 ? ghostCount / callsCompleted : 0;

  return {
    totals: {
      batches: batches.length,
      audits: totalAudits,
      auditsRunning,
      callsCompleted,
      providersTotal,
      ghostCount,
      realCount,
      voicemailCount,
      ghostRate,
    },
    byCarrier,
    byZip,
    byNeed,
    brokenSpecialties,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Standard exposure formula used by the in-app sketch and the PDF.
 * `headcount * 0.10 baseline behavioral-health prevalence * weighted ghost rate * $4,783/year`.
 */
export const PRODUCTIVITY_LOSS_PER_UNTREATED_USD = 4783;
export const BASELINE_BH_PREVALENCE = 0.1;

export function estimateExposureUsd(
  agg: EmployerAggregates,
  headcount: number,
): number {
  if (headcount <= 0) return 0;
  return Math.round(
    headcount *
      BASELINE_BH_PREVALENCE *
      agg.totals.ghostRate *
      PRODUCTIVITY_LOSS_PER_UNTREATED_USD,
  );
}

/** One audited listing — the unit emitted to the evidence CSV. */
export type EvidenceRow = {
  auditDate: string; // ISO from started_at (or empty string)
  carrier: string;
  zip: string;
  auditId: string;
  npi: string;
  providerName: string | null;
  status: "real" | "ghost" | "voicemail" | "no_answer" | "error";
  ghostReason: string | null;
  summary: string | null;
  verifiedAt: string | null;
};

/**
 * Per-call evidence rows across every batch in localStorage. Sorted by
 * (auditDate desc, carrier asc, zip asc) so the carrier sees recent activity
 * first.
 */
export function flatEvidenceRows(): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  for (const batch of listBatches()) {
    for (const child of batch.audits) {
      if (!isSimAuditId(child.id)) continue;
      const s = getSimSummary(child.id);
      if (!s) continue;
      const auditDate = s.started_at ?? batch.createdAt ?? "";
      for (const r of s.results) {
        rows.push({
          auditDate,
          carrier: s.carrier,
          zip: s.zip_code,
          auditId: s.audit_id,
          npi: r.npi,
          providerName: r.provider_name ?? null,
          status: r.status,
          ghostReason: r.ghost_reason ?? null,
          summary: r.summary ?? null,
          verifiedAt: r.verified_at ?? null,
        });
      }
    }
  }
  rows.sort((a, b) => {
    if (a.auditDate !== b.auditDate) return a.auditDate < b.auditDate ? 1 : -1;
    if (a.carrier !== b.carrier) return a.carrier < b.carrier ? -1 : 1;
    if (a.zip !== b.zip) return a.zip < b.zip ? -1 : 1;
    return 0;
  });
  return rows;
}

/** Min/max started_at across all simulated audits — used in report headers. */
export function derivePeriod(): { from: string; to: string } | null {
  let min: string | null = null;
  let max: string | null = null;
  for (const batch of listBatches()) {
    for (const child of batch.audits) {
      if (!isSimAuditId(child.id)) continue;
      const s = getSimSummary(child.id);
      if (!s || !s.started_at) continue;
      if (min == null || s.started_at < min) min = s.started_at;
      if (max == null || s.started_at > max) max = s.started_at;
    }
  }
  if (min == null || max == null) return null;
  return { from: min, to: max };
}
