// Pure client-side simulation of an audit run. Used by the employer batch flow
// so HR demos do not place real Twilio calls or hit providers_test.json.
//
// Shape parity with the backend's AuditSummary so the existing UI components
// (KPIs, status pills, results lists) work without modification.

import type { AuditSummary, CallResult } from "../api";
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
} from "./providersPool";

const STORAGE_KEY = "gnb_sim_audits";

/** ms between successive call results being revealed in the UI. */
const TICK_MS = 1500;
/** Min/max number of providers per simulated audit. */
const MIN_PROVIDERS = 26;
const MAX_PROVIDERS = 30;
/** Target ghost share — keeps the HR story coherent across batches. */
const GHOST_SHARE = 0.75;
/** Share of calls that reach voicemail rather than a live answer. */
const VOICEMAIL_SHARE = 0.08;

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

type SimContext = {
  carrier: string;
  zip: string;
  careNeeds: string[];
  planType: string;
};

type SimRecord = {
  id: string;
  startedAt: string; // ISO
  context: SimContext;
  plan: CallResult[];
};

type SimMap = Record<string, SimRecord>;

function readMap(): SimMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SimMap | null;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(map: SimMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

function genId(): string {
  const slug =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  return `sim-${slug}`;
}

/**
 * Build a fixed plan of `n` simulated CallResult entries for the given
 * context. Providers are sampled from the real Aetna NYC directory.
 * Specialties match the selected care needs. Voicemail outcomes (~8%)
 * are included alongside ghost/real results.
 */
function buildPlan(id: string, ctx: SimContext): CallResult[] {
  const rng = rngFromString(id);
  const n   = MIN_PROVIDERS + Math.floor(rng() * (MAX_PROVIDERS - MIN_PROVIDERS + 1));

  const specPool = specialtyPool(ctx.careNeeds);
  const sampled  = sampleProviders(rng, n);

  const plan: CallResult[] = [];
  for (let i = 0; i < n; i++) {
    const provider    = sampled[i];
    const roll        = rng();
    const isGhost     = roll < GHOST_SHARE;
    const isVoicemail = !isGhost && roll < GHOST_SHARE + VOICEMAIL_SHARE;
    const specialty   = pick(specPool, rng);
    const verifiedAt  = new Date().toISOString();

    if (isGhost) {
      const reason = pick(GHOST_REASONS, rng);
      plan.push({
        npi:           provider.npi,
        phone:         provider.phone,
        status:        "ghost",
        ghost_reason:  reason,
        provider_name: provider.name,
        specialty,
        transcript:    ghostTranscript(reason, provider.name, ctx.carrier, ctx.careNeeds, ctx.planType, rng),
        summary:       ghostSummary(reason, ctx.carrier),
        verified_at:   verifiedAt,
      });
    } else if (isVoicemail) {
      plan.push({
        npi:           provider.npi,
        phone:         provider.phone,
        status:        "voicemail",
        ghost_reason:  null,
        provider_name: provider.name,
        specialty,
        transcript:    voicemailTranscript(provider.name, ctx.carrier, ctx.careNeeds, rng),
        summary:       voicemailSummary(),
        verified_at:   verifiedAt,
      });
    } else {
      plan.push({
        npi:           provider.npi,
        phone:         provider.phone,
        status:        "real",
        ghost_reason:  null,
        provider_name: provider.name,
        specialty,
        transcript:    realTranscript(provider.name, ctx.carrier, ctx.careNeeds, ctx.planType, rng),
        summary:       realSummary(ctx.carrier, ctx.planType),
        verified_at:   verifiedAt,
      });
    }
  }
  return plan;
}

/**
 * Create a simulated audit. Returns its synthetic audit_id (prefixed `sim-`).
 * State is persisted in localStorage so refreshing the batch page resumes
 * from where it left off.
 */
export function simulateAudit(ctx: SimContext): { audit_id: string } {
  const id = genId();
  const plan = buildPlan(id, ctx);
  const record: SimRecord = {
    id,
    startedAt: new Date().toISOString(),
    context: ctx,
    plan,
  };
  const map = readMap();
  map[id] = record;
  writeMap(map);
  return { audit_id: id };
}

/** Synchronously compute the live snapshot of a simulated audit. */
export function getSimSummary(id: string): AuditSummary | null {
  const map = readMap();
  const rec = map[id];
  if (!rec) return null;

  const elapsedMs = Date.now() - new Date(rec.startedAt).getTime();
  const idx = Math.min(
    rec.plan.length,
    Math.max(0, Math.floor(elapsedMs / TICK_MS)),
  );
  const revealed      = rec.plan.slice(0, idx);
  const ghostCount    = revealed.filter(r => r.status === "ghost").length;
  const realCount     = revealed.filter(r => r.status === "real").length;
  const voicemailCount = revealed.filter(r => r.status === "voicemail").length;
  const otherCount    = revealed.length - ghostCount - realCount - voicemailCount;
  const ghostRate     = revealed.length > 0 ? ghostCount / revealed.length : 0;
  const isComplete    = idx >= rec.plan.length;
  const completedAt   = isComplete
    ? new Date(new Date(rec.startedAt).getTime() + rec.plan.length * TICK_MS).toISOString()
    : null;

  return {
    audit_id:          id,
    status:            isComplete ? "completed" : "running",
    carrier:           rec.context.carrier,
    zip_code:          rec.context.zip,
    care_needs:        rec.context.careNeeds,
    plan_type:         rec.context.planType,
    member_plan_label: null,
    recording_consent: true,
    terms_acknowledged: true,
    started_at:        rec.startedAt,
    completed_at:      completedAt,
    providers_total:   rec.plan.length,
    calls_completed:   revealed.length,
    ghost_count:       ghostCount,
    real_count:        realCount,
    voicemail_count:   voicemailCount,
    other_count:       otherCount,
    ghost_rate:        ghostRate,
    voicemail_rate:    revealed.length > 0 ? voicemailCount / revealed.length : 0,
    high_ghost_rate:   revealed.length >= 4 && ghostRate >= 0.6,
    complaint_eligible: ghostCount > 0,
    error:             null,
    share_path:        `/app/employer/audits/${id}`,
    voice_mode:        "simulated",
    loop_agent_note:   null,
    rag_hits:          [],
    top_providers:     revealed.filter(r => r.status === "real"),
    results:           revealed,
  };
}

/** True if `id` was minted by this module. Cheap check for callers. */
export function isSimAuditId(id: string): boolean {
  return typeof id === "string" && id.startsWith("sim-");
}
