import type { AuditSummary } from "./api";
import {
  ghostSummary,
  ghostTranscript,
  GHOST_REASONS,
  realSummary,
  realTranscript,
  sampleProviders,
  specialtyPool,
  voicemailSummary,
  voicemailTranscript,
} from "./data/providersPool";

export const DEMO_AUDIT_ID = "demo";
export const DEMO_REPLAY_INTERVAL_MS = 1500; // 1.5s per call — fast demo pace (~26 calls in 40s)

export type DemoContext = {
  carrier?: string;
  zip?: string;
  careNeeds?: string[];
  planType?: string;
};

/** Deterministic RNG seeded from a string (FNV-1a + Xorshift32). */
function rngFromString(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/**
 * Generate a complete demo AuditSummary from an optional context.
 * Results are deterministic: the same (carrier, zip, careNeeds, planType)
 * combination always produces the same provider list and outcomes.
 * Defaults to Aetna / 10001 / Anxiety + Trauma PTSD / commercial.
 */
export function buildDemoSummary(ctx?: DemoContext): AuditSummary {
  const carrier   = ctx?.carrier                            ?? "Aetna";
  const zip       = ctx?.zip                                ?? "10001";
  const careNeeds = ctx?.careNeeds?.length ? ctx.careNeeds  : ["Anxiety", "Trauma / PTSD"];
  const planType  = ctx?.planType                           ?? "commercial";

  const seed = `${carrier}|${zip}|${careNeeds.join(",")}|${planType}`;
  const rng  = rngFromString(seed);

  const n         = 26 + Math.floor(rng() * 5); // 26–30 providers (~40s at 1.5s/call)
  const specPool  = specialtyPool(careNeeds);

  // Sample real provider entries from the Aetna NYC directory
  const sampled = sampleProviders(rng, n);

  // Fixed base timestamp so verified_at values look plausible
  const startMs = new Date("2026-05-02T10:00:00Z").getTime();

  const results: AuditSummary["results"] = [];
  let ghostCount = 0;
  let realCount  = 0;

  for (let i = 0; i < n; i++) {
    const provider   = sampled[i];
    const isGhost    = rng() < 0.75;
    const specialty  = pick(specPool, rng);
    const verifiedAt = new Date(startMs + (i + 1) * 90_000).toISOString();

    if (isGhost) {
      const reason = pick(GHOST_REASONS, rng);
      results.push({
        npi:           provider.npi,
        phone:         provider.phone,
        status:        "ghost",
        ghost_reason:  reason,
        provider_name: provider.name,
        specialty,
        transcript:    ghostTranscript(reason, provider.name, carrier, careNeeds, planType, rng),
        summary:       ghostSummary(reason, carrier),
        verified_at:   verifiedAt,
      });
      ghostCount++;
    } else {
      results.push({
        npi:           provider.npi,
        phone:         provider.phone,
        status:        "real",
        ghost_reason:  null,
        provider_name: provider.name,
        specialty,
        transcript:    realTranscript(provider.name, carrier, careNeeds, planType, rng),
        summary:       realSummary(carrier, planType),
        verified_at:   verifiedAt,
      });
      realCount++;
    }
  }

  const ghostRate   = results.length > 0 ? ghostCount / results.length : 0;
  const startedAt   = new Date(startMs).toISOString();
  const completedAt = new Date(startMs + n * 90_000 + 60_000).toISOString();

  return {
    audit_id:          DEMO_AUDIT_ID,
    status:            "completed",
    carrier,
    zip_code:          zip,
    care_needs:        careNeeds,
    plan_type:         planType,
    member_plan_label: null,
    recording_consent: true,
    terms_acknowledged: true,
    started_at:        startedAt,
    completed_at:      completedAt,
    providers_total:   n,
    calls_completed:   n,
    ghost_count:       ghostCount,
    real_count:        realCount,
    voicemail_count:   0,
    other_count:       0,
    ghost_rate:        ghostRate,
    voicemail_rate:    0,
    high_ghost_rate:   ghostRate >= 0.7,
    complaint_eligible: ghostCount > 0,
    error:             null,
    share_path:        "/results/demo",
    voice_mode:        "pipecat",
    loop_agent_note:   null,
    rag_hits:          [],
    top_providers:     results.filter(r => r.status === "real"),
    results,
  };
}

/** Default demo — shown when no context is available (e.g. Dashboard replay). */
export const DEMO_SUMMARY: AuditSummary = buildDemoSummary();
