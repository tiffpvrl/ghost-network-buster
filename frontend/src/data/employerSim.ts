// Pure client-side simulation of an audit run. Used by the employer batch flow
// so HR demos do not place real Twilio calls or hit providers_test.json.
//
// Shape parity with the backend's AuditSummary so the existing UI components
// (KPIs, status pills, results lists) work without modification.

import type { AuditSummary, CallResult } from "../api";

const STORAGE_KEY = "gnb_sim_audits";

/** ms between successive call results being revealed in the UI. */
const TICK_MS = 3500;
/** Min/max number of providers per simulated audit. */
const MIN_PROVIDERS = 6;
const MAX_PROVIDERS = 9;
/** Target ghost share — keeps the HR story coherent across batches. */
const GHOST_SHARE = 0.75;

const FIRST_NAMES = [
  "Sarah", "Marcus", "Linda", "James", "Patricia", "Kevin", "Maya", "Aaron",
  "Rebecca", "Daniel", "Elena", "Ethan", "Priya", "Tomás", "Imani", "Noah",
];
const LAST_NAMES = [
  "Chen", "Webb", "Okafor", "Ostrowski", "Gonzalez", "Park", "Bernstein",
  "Nguyen", "Patel", "Rivera", "Diop", "Brennan", "Kovac", "Tanaka", "Adeyemi",
];
const CREDENTIALS = ["LCSW", "PhD", "PsyD", "LMFT", "MD", "LMHC"];
const SPECIALTIES = [
  "Anxiety, Trauma",
  "CBT, Depression",
  "General Therapy",
  "Trauma-Informed CBT",
  "Behavioral Health",
  "Anxiety, PTSD",
  "Couples & Family",
  "Adult ADHD",
];
const CLINIC_NAMES = [
  "Hudson Mind Collective",
  "East Side Wellness Center",
  "Brooklyn Mind Collective",
  "Midtown Behavioral Health",
  "Riverside Counseling Group",
  "Park Slope Therapy Partners",
  "Harbor Health Behavioral",
  "Greenpoint Wellness Center",
];

const GHOST_REASONS = [
  "disconnected",
  "wrong_network",
  "not_accepting_patients",
  "wrong_provider",
  "no_behavioral_health",
  "retired",
] as const;

type GhostReason = (typeof GHOST_REASONS)[number];

function ghostSummary(reason: GhostReason, carrier: string): string {
  switch (reason) {
    case "disconnected":
      return "Number disconnected. Provider unreachable.";
    case "wrong_network":
      return `No longer in ${carrier} network.`;
    case "not_accepting_patients":
      return "Closed waitlist, no timeline to reopen.";
    case "wrong_provider":
      return "Provider left practice over a year ago.";
    case "no_behavioral_health":
      return "Listed in directory but does not offer behavioral health.";
    case "retired":
      return "Retired. Practice closed to new patients.";
  }
}

function ghostTranscript(
  reason: GhostReason,
  providerName: string,
  carrier: string,
): string {
  const base = `Agent: Hi, calling to verify whether ${providerName} accepts ${carrier} insurance and is taking new patients.`;
  switch (reason) {
    case "disconnected":
      return `${base}\n[Automated message: The number you have dialed has been disconnected.]\nAgent: Logging result — disconnected number.`;
    case "wrong_network":
      return `${base}\nReceptionist: We dropped ${carrier} a while back. We're cash-pay now.\nAgent: Any plan to rejoin networks?\nReceptionist: No.`;
    case "not_accepting_patients":
      return `${base}\nReceptionist: We're full. The waitlist has been closed for months.\nAgent: Any timeline to reopen?\nReceptionist: I don't know — try elsewhere.`;
    case "wrong_provider":
      return `${base}\nReceptionist: That provider hasn't practiced here in years.\nAgent: Anyone else on staff in-network with ${carrier}?\nReceptionist: No.`;
    case "no_behavioral_health":
      return `${base}\nReceptionist: This office doesn't do behavioral health at all.\nAgent: They're listed in ${carrier}'s behavioral directory — is that a mistake?\nReceptionist: It must be.`;
    case "retired":
      return `${base}\nReceptionist: They retired. This line is forwarded to billing only.\nAgent: Any other provider at this location?\nReceptionist: No.`;
  }
}

function realSummary(carrier: string): string {
  return `Confirmed in-network with ${carrier}. Accepting new patients with availability in 1-3 weeks.`;
}

function realTranscript(providerName: string, carrier: string): string {
  return `Agent: Hi, calling to confirm whether ${providerName} accepts ${carrier} for outpatient therapy.\nReceptionist: Yes — we're in-network with ${carrier} and we have openings.\nAgent: Are you taking new patients?\nReceptionist: We can typically schedule within two weeks.`;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Tiny deterministic-ish RNG seeded from the audit id so re-renders are stable. */
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
 * (carrier, zip). The order is the order in which they will be revealed.
 */
function buildPlan(id: string, ctx: SimContext): CallResult[] {
  const rng = rngFromString(id);
  const n =
    MIN_PROVIDERS + Math.floor(rng() * (MAX_PROVIDERS - MIN_PROVIDERS + 1));

  const plan: CallResult[] = [];
  for (let i = 0; i < n; i++) {
    const isGhost = rng() < GHOST_SHARE;
    const isClinic = rng() < 0.25;
    const providerName = isClinic
      ? pick(CLINIC_NAMES, rng)
      : `Dr. ${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}, ${pick(CREDENTIALS, rng)}`;
    const npi = String(1_000_000_000 + Math.floor(rng() * 900_000_000));
    const phoneArea = ctx.zip.startsWith("11") ? "718" : "212";
    const phone = `${phoneArea}-555-${String(100 + Math.floor(rng() * 899)).padStart(3, "0")}${Math.floor(rng() * 10)}`;
    const specialty = pick(SPECIALTIES, rng);
    const verifiedAt = new Date().toISOString();

    if (isGhost) {
      const reason = pick(GHOST_REASONS, rng);
      plan.push({
        npi,
        phone,
        status: "ghost",
        ghost_reason: reason,
        provider_name: providerName,
        specialty,
        transcript: ghostTranscript(reason, providerName, ctx.carrier),
        summary: ghostSummary(reason, ctx.carrier),
        verified_at: verifiedAt,
      });
    } else {
      plan.push({
        npi,
        phone,
        status: "real",
        ghost_reason: null,
        provider_name: providerName,
        specialty,
        transcript: realTranscript(providerName, ctx.carrier),
        summary: realSummary(ctx.carrier),
        verified_at: verifiedAt,
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
  const revealed = rec.plan.slice(0, idx);
  const ghostCount = revealed.filter((r) => r.status === "ghost").length;
  const realCount = revealed.filter((r) => r.status === "real").length;
  const voicemailCount = revealed.filter((r) => r.status === "voicemail").length;
  const otherCount = revealed.length - ghostCount - realCount - voicemailCount;
  const ghostRate = revealed.length > 0 ? ghostCount / revealed.length : 0;
  const isComplete = idx >= rec.plan.length;
  const completedAt = isComplete
    ? new Date(
        new Date(rec.startedAt).getTime() + rec.plan.length * TICK_MS,
      ).toISOString()
    : null;

  return {
    audit_id: id,
    status: isComplete ? "completed" : "running",
    carrier: rec.context.carrier,
    zip_code: rec.context.zip,
    care_needs: rec.context.careNeeds,
    plan_type: rec.context.planType,
    member_plan_label: null,
    recording_consent: true,
    terms_acknowledged: true,
    started_at: rec.startedAt,
    completed_at: completedAt,
    providers_total: rec.plan.length,
    calls_completed: revealed.length,
    ghost_count: ghostCount,
    real_count: realCount,
    voicemail_count: voicemailCount,
    other_count: otherCount,
    ghost_rate: ghostRate,
    voicemail_rate: revealed.length > 0 ? voicemailCount / revealed.length : 0,
    high_ghost_rate: revealed.length >= 4 && ghostRate >= 0.6,
    complaint_eligible: ghostCount > 0,
    error: null,
    share_path: `/app/employer/audits/${id}`,
    voice_mode: "simulated",
    loop_agent_note: null,
    rag_hits: [],
    top_providers: revealed.filter((r) => r.status === "real"),
    results: revealed,
  };
}

/** True if `id` was minted by this module. Cheap check for callers. */
export function isSimAuditId(id: string): boolean {
  return typeof id === "string" && id.startsWith("sim-");
}
