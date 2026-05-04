// Carrier Renewal Negotiation Packet — data types and assembly logic.
// Translates raw employer audit aggregates + user-provided renewal context into
// a structured packet object consumed by the PDF generator and in-page preview.

import type { EmployerAggregates, EvidenceRow } from "../data/employerAggregates";

// ── Input from HR form ────────────────────────────────────────────────────────

export type EmployerPacketInput = {
  employerName: string;
  carrierName: string;
  planName: string;
  renewalYear: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  marketsReviewed: string;
  coveredEmployees: number | null;
  proposedRenewalIncrease: number | null;
  annualPlanSpend: number | null;
  renewalGoals: string;
  ghostRateThreshold: number; // 0..1, default 0.20
};

// ── Derived summary computed from aggregates ──────────────────────────────────

export type EmployerPacketSummary = {
  totalProvidersAudited: number;
  confirmedAvailable: number;
  ghostCount: number;
  voicemailOrInconclusive: number;
  ghostRate: number;
  marketsAffected: number;
  highestGhostRateMarket: string;
  mostCommonFailureReason: string;
  avgCallsToReachable: number | null;
};

// ── Per-geography evidence row ────────────────────────────────────────────────

export type MarketEvidence = {
  marketName: string;
  providersAudited: number;
  availableCount: number;
  ghostCount: number;
  voicemailCount: number;
  ghostRate: number;
  primaryFailurePattern: string;
};

// ── Per-provider evidence row ─────────────────────────────────────────────────

export type ProviderEvidence = {
  providerName: string;
  directoryStatus: string;
  auditResult: string;
  failureReason: string;
  market: string;
  zipCode: string;
  callTimestamp: string;
  evidenceType: string;
  transcriptExcerpt: string;
  confidenceLevel: string;
};

// ── Financial impact section ──────────────────────────────────────────────────

export type FinancialImpact = {
  proposedAnnualIncrease: number | null;
  costPerCoveredEmployee: number | null;
  estimatedAffectedPopulation: number | null;
  conservativeConcessionTarget: number | null;
  aggressiveConcessionTarget: number | null;
  nonMonetaryConcessions: string[];
};

// ── Assembled packet ──────────────────────────────────────────────────────────

export type NegotiationPacket = {
  input: EmployerPacketInput;
  summary: EmployerPacketSummary;
  marketEvidence: MarketEvidence[];
  providerEvidence: ProviderEvidence[];
  financialImpact: FinancialImpact;
  generatedAt: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const GHOST_REASON_LABELS: Record<string, string> = {
  disconnected: "Disconnected number",
  wrong_network: "Not in-network",
  not_accepting_patients: "Not accepting new patients",
  wrong_provider: "Wrong provider at number",
  no_behavioral_health: "No behavioral health services",
  retired: "Provider no longer practicing",
};

function classifyEvidenceType(
  status: string,
  ghostReason: string | null,
): string {
  if (status === "ghost") {
    if (ghostReason === "disconnected") return "Disconnected number log";
    if (ghostReason === "wrong_network") return "Plan rejection confirmation";
    if (ghostReason === "wrong_provider") return "Wrong number confirmation";
    return "Timestamped call transcript";
  }
  if (status === "voicemail") return "Voicemail attempt log";
  if (status === "real") return "Provider confirmation";
  return "Timestamped call transcript";
}

function mostCommonReason(evidenceRows: EvidenceRow[]): string {
  const counts = new Map<string, number>();
  for (const r of evidenceRows) {
    if (r.status === "ghost" && r.ghostReason) {
      counts.set(r.ghostReason, (counts.get(r.ghostReason) ?? 0) + 1);
    }
  }
  let top = "—";
  let max = 0;
  for (const [reason, count] of counts) {
    if (count > max) {
      max = count;
      top = GHOST_REASON_LABELS[reason] ?? reason;
    }
  }
  return top;
}

function zipPrimaryPattern(zip: string, evidenceRows: EvidenceRow[]): string {
  const counts = new Map<string, number>();
  for (const r of evidenceRows) {
    if (r.zip === zip && r.status === "ghost" && r.ghostReason) {
      counts.set(r.ghostReason, (counts.get(r.ghostReason) ?? 0) + 1);
    }
  }
  let top = "—";
  let max = 0;
  for (const [reason, count] of counts) {
    if (count > max) {
      max = count;
      top = GHOST_REASON_LABELS[reason] ?? reason;
    }
  }
  return top;
}

// ── Main assembly function ────────────────────────────────────────────────────

export function assemblePacket(
  input: EmployerPacketInput,
  agg: EmployerAggregates,
  evidenceRows: EvidenceRow[],
): NegotiationPacket {
  // Summary
  const totalProvidersAudited =
    agg.totals.providersTotal || agg.totals.callsCompleted;
  const confirmedAvailable = agg.totals.realCount;
  const ghostCount = agg.totals.ghostCount;
  const voicemailOrInconclusive = agg.totals.voicemailCount;
  const ghostRate = agg.totals.ghostRate;
  const marketsAffected = agg.byZip.length;

  // Highest ghost rate market (by ghost share within ZIP)
  const highestGhostZip = agg.byZip.reduce(
    (best, z) => {
      const total = z.ghostCount + z.realCount;
      const rate = total > 0 ? z.ghostCount / total : 0;
      return rate > best.rate ? { zip: z.zip, rate } : best;
    },
    { zip: "", rate: 0 },
  );
  const highestGhostRateMarket = highestGhostZip.zip
    ? `ZIP ${highestGhostZip.zip} (${(highestGhostZip.rate * 100).toFixed(0)}%)`
    : "—";

  const avgCallsToReachable =
    confirmedAvailable > 0
      ? Math.round((agg.totals.callsCompleted / confirmedAvailable) * 10) / 10
      : null;

  const summary: EmployerPacketSummary = {
    totalProvidersAudited,
    confirmedAvailable,
    ghostCount,
    voicemailOrInconclusive,
    ghostRate,
    marketsAffected,
    highestGhostRateMarket,
    mostCommonFailureReason: mostCommonReason(evidenceRows),
    avgCallsToReachable,
  };

  // Market evidence — one row per ZIP from aggregates
  const marketEvidence: MarketEvidence[] = agg.byZip.map((z) => {
    const total = z.ghostCount + z.realCount;
    const rate = total > 0 ? z.ghostCount / total : 0;
    // Approximate providers audited per ZIP from evidence rows
    const zipRows = evidenceRows.filter((r) => r.zip === z.zip);
    const voicemailCount = zipRows.filter((r) => r.status === "voicemail").length;

    return {
      marketName: `ZIP ${z.zip}`,
      providersAudited: Math.max(z.ghostCount + z.realCount + voicemailCount, z.audits),
      availableCount: z.realCount,
      ghostCount: z.ghostCount,
      voicemailCount,
      ghostRate: rate,
      primaryFailurePattern: zipPrimaryPattern(z.zip, evidenceRows),
    };
  });

  // Provider evidence — up to 60 rows, ghosts first
  const sortedRows = [...evidenceRows].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "ghost") return -1;
      if (b.status === "ghost") return 1;
    }
    return (b.auditDate ?? "").localeCompare(a.auditDate ?? "");
  });

  const providerEvidence: ProviderEvidence[] = sortedRows.slice(0, 60).map((r) => {
    const excerpt = r.summary
      ? r.summary.slice(0, 130) + (r.summary.length > 130 ? "…" : "")
      : "—";
    return {
      providerName: r.providerName ?? "Unknown provider",
      directoryStatus: "Listed in-network",
      auditResult: r.status.charAt(0).toUpperCase() + r.status.slice(1),
      failureReason:
        r.ghostReason
          ? (GHOST_REASON_LABELS[r.ghostReason] ?? r.ghostReason)
          : r.status === "real"
          ? "N/A — confirmed available"
          : "—",
      market: `ZIP ${r.zip}`,
      zipCode: r.zip,
      callTimestamp: r.auditDate ? r.auditDate.slice(0, 10) : "—",
      evidenceType: classifyEvidenceType(r.status, r.ghostReason),
      transcriptExcerpt: excerpt,
      confidenceLevel:
        r.status === "real" || r.status === "ghost" ? "High" : "Medium",
    };
  });

  // Financial impact
  const proposed = input.proposedRenewalIncrease;
  const employees = input.coveredEmployees;
  const costPerEmployee =
    proposed != null && employees != null && employees > 0
      ? Math.round(proposed / employees)
      : null;
  const estimatedAffectedPopulation =
    employees != null
      ? Math.round(employees * 0.1 * ghostRate)
      : null;
  const conservativeConcessionTarget =
    proposed != null ? Math.round(proposed * 0.15) : null;
  const aggressiveConcessionTarget =
    proposed != null ? Math.round(proposed * 0.35) : null;

  const financialImpact: FinancialImpact = {
    proposedAnnualIncrease: proposed,
    costPerCoveredEmployee: costPerEmployee,
    estimatedAffectedPopulation,
    conservativeConcessionTarget,
    aggressiveConcessionTarget,
    nonMonetaryConcessions: [
      "Written network remediation plan within 30 days",
      "Quarterly verified directory audit with employer-facing reporting",
      "Temporary out-of-network reimbursement for employees unable to access listed providers",
      "Dedicated escalation pathway with a named carrier contact",
      "Behavioral health access service-level agreement with measurable standards",
    ],
  };

  return {
    input,
    summary,
    marketEvidence,
    providerEvidence,
    financialImpact,
    generatedAt: new Date().toISOString(),
  };
}
