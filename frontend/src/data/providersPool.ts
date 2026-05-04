/**
 * Shared mock-data utilities for patient demo and employer sim.
 *
 * Provider names, NPIs, and phones are sampled from the real Aetna NYC
 * directory (879 entries) so results look authentic at any scale.
 * No real calls are ever placed — this module is purely client-side.
 */

import rawProviders from "./providersAetnaNyc.json";

// ---------------------------------------------------------------------------
// Provider pool
// ---------------------------------------------------------------------------

export type ProviderEntry = {
  npi: string;
  name: string;  // title-cased display name
  phone: string; // formatted XXX-XXX-XXXX
  specialty: string;
};

const CREDENTIAL_TOKENS = new Set([
  "MD", "DO", "PHD", "PSYD", "NP", "APRN", "PMHNP", "RN", "PA",
  "LCSW", "LMFT", "LMHC", "LMSW", "MSW", "MFT", "LPC", "LPCC", "BCBA",
  "MA", "MBA", "MPH", "PLLC", "LLC", "N.P", "CPNP", "MHC", "LP",
  "LMHC", "CASAC", "CAC", "CSAT", "CSW",
]);

function titleCaseName(raw: string): string {
  return raw
    .split(/(\s+)/)
    .map(part => {
      if (/^\s+$/.test(part)) return part;
      const trailing = part.endsWith(",") ? "," : "";
      const core = part.replace(/,$/, "");
      if (CREDENTIAL_TOKENS.has(core.toUpperCase())) return core.toUpperCase() + trailing;
      if (/^[A-Z]$/.test(core)) return core + trailing; // single-letter initial
      if (core.startsWith('"')) return core + trailing;  // quoted suffix like "R"
      return core.charAt(0).toUpperCase() + core.slice(1).toLowerCase() + trailing;
    })
    .join("");
}

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    const local = digits.slice(1);
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

export const PROVIDERS: readonly ProviderEntry[] = (
  rawProviders as { npi: string; name: string; phone: string; specialty: string }[]
).map(p => ({
  npi: p.npi,
  name: titleCaseName(p.name),
  phone: formatPhone(p.phone),
  specialty: p.specialty,
}));

/**
 * Deterministically sample `n` unique providers using the supplied RNG.
 * Uses a partial Fisher-Yates shuffle so the same RNG state always yields
 * the same subset.
 */
export function sampleProviders(rng: () => number, n: number): ProviderEntry[] {
  const arr = [...PROVIDERS];
  const count = Math.min(n, arr.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, count);
}

// ---------------------------------------------------------------------------
// Care-need → specialty label mapping
// ---------------------------------------------------------------------------

export const CARE_NEED_SPECIALTIES: Record<string, string[]> = {
  "Anxiety":          ["Anxiety Disorders", "Anxiety, Trauma", "Generalized Anxiety & Stress", "Anxiety & Panic Disorders"],
  "Depression":       ["CBT, Depression", "Mood Disorders", "Depression & Bipolar", "Depression, Anxiety"],
  "Trauma / PTSD":    ["Trauma-Informed CBT", "PTSD & Trauma", "Trauma, Anxiety / PTSD", "Complex Trauma, EMDR"],
  "ADHD":             ["Adult ADHD", "ADHD & Executive Function", "Child/Adolescent ADHD", "ADHD, Anxiety"],
  "Addiction":        ["Substance Use Disorder", "Addiction Counseling", "SUD & Recovery", "Dual Diagnosis, SUD"],
  "Grief":            ["Grief & Loss", "Bereavement Counseling", "Grief, Trauma", "Life Transitions, Grief"],
  "LGBTQ+ Affirming": ["LGBTQ+ Affirming Therapy", "Queer Affirming Practice", "Gender Identity & Sexuality"],
  "Sliding Scale":    ["Community Mental Health", "Sliding Scale, General Therapy", "Low-Fee Counseling"],
};

export const FALLBACK_SPECIALTIES = [
  "Anxiety, Trauma", "CBT, Depression", "General Therapy", "Trauma-Informed CBT",
  "Behavioral Health", "Anxiety, PTSD", "Couples & Family", "Adult ADHD",
];

export function specialtyPool(careNeeds: string[]): string[] {
  const pool: string[] = [];
  for (const need of careNeeds) {
    const mapped = CARE_NEED_SPECIALTIES[need];
    if (mapped) pool.push(...mapped);
  }
  return pool.length > 0 ? pool : FALLBACK_SPECIALTIES;
}

// ---------------------------------------------------------------------------
// Helpers used inside transcript templates
// ---------------------------------------------------------------------------

export function areaCodeForZip(zip: string): string {
  if (!zip || zip.length < 3) return "212";
  const p3 = zip.slice(0, 3);
  if (p3 === "100" || p3 === "101") return "212"; // Manhattan
  if (p3 === "102" || p3 === "104") return "718"; // Bronx
  if (p3 === "103") return "718";                  // Staten Island
  if (zip.startsWith("11")) return "718";           // Brooklyn / Queens
  return "212";
}

export function planLabel(planType: string, carrier: string): string {
  switch (planType) {
    case "medicaid": return `${carrier} Medicaid managed care`;
    case "medicare": return `${carrier} Medicare Advantage`;
    case "employer": return `${carrier} employer-sponsored (ERISA) plan`;
    default:         return carrier;
  }
}

// ---------------------------------------------------------------------------
// Ghost reasons
// ---------------------------------------------------------------------------

export const GHOST_REASONS = [
  "disconnected",
  "wrong_network",
  "not_accepting_patients",
  "wrong_provider",
  "no_behavioral_health",
  "retired",
] as const;

export type GhostReason = (typeof GHOST_REASONS)[number];

// ---------------------------------------------------------------------------
// Multi-variant transcripts
// ---------------------------------------------------------------------------

type TFn = (pn: string, plan: string, carrier: string, need: string) => string;

const GHOST_VARIANTS: Record<GhostReason, TFn[]> = {
  disconnected: [
    (pn, pl) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} and is taking new patients.\n` +
      `[Automated message: The number you have dialed has been disconnected or is no longer in service.]\n` +
      `Agent: Logging result — disconnected number.`,
    (pn, pl) =>
      `Agent: Hi, verifying ${pn}'s network status under ${pl}.\n` +
      `[Automated message: We're sorry, the number you have reached is not in service. Please check the number and try again.]\n` +
      `Agent: Logging result — number not in service.`,
    (pn, pl) =>
      `Agent: Hi, calling to confirm ${pn}'s availability under ${pl}.\n` +
      `[Three-tone SIT signal]\n` +
      `[Automated message: This number is no longer in service. No further information is available.]\n` +
      `Agent: Logging result — disconnected.`,
  ],
  wrong_network: [
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
      `Receptionist: We dropped ${c} a while back — the practice is fully out-of-network now.\n` +
      `Agent: Any plans to re-credential with ${c}?\n` +
      `Receptionist: No. I'd suggest looking elsewhere.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} for ${nd}.\n` +
      `Office manager: We terminated our ${c} contract last year. We're cash-pay only now.\n` +
      `Agent: Any timeline to rejoin the network?\n` +
      `Office manager: Not that I'm aware of.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, verifying whether ${pn} participates with ${c} for ${nd}.\n` +
      `Staff: We don't accept ${c} at this location — haven't for a few years.\n` +
      `Agent: Is that across all providers here?\n` +
      `Staff: Yes, we opted out entirely.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to confirm ${pn}'s ${c} network status for ${nd}.\n` +
      `Billing: The provider opted out of ${c}'s network. You'd need to verify out-of-network benefits.\n` +
      `Agent: Any plans to re-enroll?\n` +
      `Billing: I don't have visibility into that.`,
  ],
  not_accepting_patients: [
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
      `Receptionist: We're completely full. The waitlist has been closed for months with no timeline to reopen.\n` +
      `Agent: Any estimate on when intake might open?\n` +
      `Receptionist: Honestly no — I'd recommend looking elsewhere.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to confirm whether ${pn} is accepting new ${c} patients for ${nd}.\n` +
      `Front desk: We're not taking any new patients right now — at capacity across the board.\n` +
      `Agent: Is there a waitlist I can get on?\n` +
      `Front desk: We're not maintaining a waitlist at this time either.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, verifying new patient availability at ${pn} for ${nd} under ${c}.\n` +
      `Receptionist: New patient intake has been suspended indefinitely. We're only seeing existing patients.\n` +
      `Agent: Any referrals you can offer?\n` +
      `Receptionist: I'd suggest checking the ${c} directory for other in-network providers.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, confirming ${pn}'s availability for ${nd} under ${pl}.\n` +
      `Scheduler: They are in-network but the waitlist is over six months — and it's technically closed.\n` +
      `Agent: Six months minimum?\n` +
      `Scheduler: At least. We can't commit to any timeline right now.`,
  ],
  wrong_provider: [
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
      `Receptionist: That provider hasn't been at this location for over two years.\n` +
      `Agent: Do you know where they relocated?\n` +
      `Receptionist: We don't. And we have no other ${c} providers on staff.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, trying to reach ${pn} to verify their ${c} status for ${nd}.\n` +
      `Staff: That provider left the practice a long time ago — no forwarding information was left.\n` +
      `Agent: Is there anyone else at this location in-network with ${c}?\n` +
      `Staff: No, there isn't.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to confirm ${pn}'s availability for ${nd} under ${pl}.\n` +
      `Receptionist: I don't recognize that provider as being associated with our practice.\n` +
      `Agent: They're listed at this address in the ${c} directory.\n` +
      `Receptionist: That listing must be outdated — we'd suggest contacting ${c} to correct it.`,
  ],
  no_behavioral_health: [
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} for ${nd}.\n` +
      `Receptionist: This office doesn't offer behavioral health services at all.\n` +
      `Agent: They're listed in ${c}'s behavioral health directory — is that an error?\n` +
      `Receptionist: It has to be. We've reported this kind of thing before.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, verifying whether ${pn} provides ${nd} services under ${c}.\n` +
      `Staff: We're a primary care practice — no mental health or behavioral health services here.\n` +
      `Agent: Is there any behavioral health provider on staff?\n` +
      `Staff: No. You'll need to look elsewhere.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to confirm ${pn}'s availability for ${nd} under ${pl}.\n` +
      `Front desk: We're a specialty surgical practice. We don't do therapy or behavioral health.\n` +
      `Agent: They appear in ${c}'s behavioral health network directory — do you know how that happened?\n` +
      `Front desk: No idea. This isn't the first time we've heard this.`,
  ],
  retired: [
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to verify if ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
      `Receptionist: That provider retired and the practice is closed to patients.\n` +
      `Agent: Is there another ${c} provider at this location?\n` +
      `Receptionist: No — we're handling final billing only at this point.`,
    (pn, pl, c) =>
      `Agent: Hi, verifying ${pn}'s availability and ${c} status.\n` +
      `Voice: This is billing for the former practice. The provider retired in 2024 and is no longer seeing patients.\n` +
      `Agent: Is the practice closed entirely?\n` +
      `Voice: Yes, fully closed. This line is for billing inquiries only.`,
    (pn, pl, c, nd) =>
      `Agent: Hi, calling to confirm whether ${pn} accepts ${pl} for ${nd}.\n` +
      `Receptionist: That provider retired earlier this year and the practice has closed.\n` +
      `Agent: Any referral to another ${c} provider nearby?\n` +
      `Receptionist: We'd suggest calling ${c} member services directly — we don't have referrals.`,
  ],
};

const REAL_VARIANTS: TFn[] = [
  (pn, pl, c, nd) =>
    `Agent: Hi, calling to confirm whether ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
    `Receptionist: Yes — we're in-network with ${c} and we do have availability.\n` +
    `Agent: Can you confirm new patient intake is currently open?\n` +
    `Receptionist: Absolutely. We can typically schedule within 1–2 weeks.`,
  (pn, pl, c, nd) =>
    `Agent: Hi, verifying whether ${pn} is in-network with ${c} and accepting new patients for ${nd}.\n` +
    `Front desk: Yes, we're in-network and actually have openings this week.\n` +
    `Agent: And ${c} is confirmed as accepted?\n` +
    `Front desk: Yes, we verified the credentialing recently.`,
  (pn, pl, c, nd) =>
    `Agent: Hi, calling to verify ${pn}'s status with ${c} for ${nd}.\n` +
    `Scheduler: We're in-network with ${c} and accepting new patients. Next available is about 10 days out.\n` +
    `Agent: And that covers ${nd} specifically?\n` +
    `Scheduler: Yes, that's one of our focus areas.`,
  (pn, pl, c, nd) =>
    `Agent: Hi, confirming ${pn}'s network participation and availability for ${nd} under ${c}.\n` +
    `Receptionist: Yes — we accept ${c} and have slots available this month.\n` +
    `Agent: Are they handling ${nd} cases?\n` +
    `Receptionist: Yes, we work with that regularly.`,
];

const VOICEMAIL_VARIANTS: TFn[] = [
  (pn, pl, c, nd) =>
    `Agent: Hi, calling to verify whether ${pn} accepts ${pl} and is taking new patients for ${nd}.\n` +
    `[Voicemail: You have reached the office of ${pn}. We are unable to take your call. Please leave a message after the beep.]\n` +
    `Agent: Left voicemail — could not confirm network status or availability.`,
  (pn, pl, c, nd) =>
    `Agent: Hi, calling to verify ${pn}'s ${c} network status for ${nd}.\n` +
    `[Voicemail: Hi, you've reached ${pn}. Our office hours are Monday through Friday, 9am to 5pm. Please leave a detailed message and we'll return your call.]\n` +
    `Agent: Left voicemail. No live confirmation of availability.`,
  (pn, pl, c, nd) =>
    `Agent: Hi, trying to confirm whether ${pn} is in-network with ${c} and seeing new patients for ${nd}.\n` +
    `[Automated: The office is currently closed. Please call back during business hours or press 1 to leave a message.]\n` +
    `Agent: Reached after-hours message. Could not confirm participation or availability.`,
];

function pickVariant<T>(variants: T[], rng: () => number): T {
  return variants[Math.floor(rng() * variants.length) % variants.length];
}

// ---------------------------------------------------------------------------
// Public transcript API — each call picks a variant via the supplied RNG
// ---------------------------------------------------------------------------

export function ghostTranscript(
  reason: GhostReason,
  providerName: string,
  carrier: string,
  careNeeds: string[],
  planType: string,
  rng: () => number,
): string {
  const plan = planLabel(planType, carrier);
  const need = careNeeds.length > 0 ? careNeeds[0].toLowerCase() : "mental health therapy";
  return pickVariant(GHOST_VARIANTS[reason], rng)(providerName, plan, carrier, need);
}

export function ghostSummary(reason: GhostReason, carrier: string): string {
  switch (reason) {
    case "disconnected":           return "Number disconnected. Provider unreachable.";
    case "wrong_network":          return `No longer in ${carrier} network.`;
    case "not_accepting_patients": return "Closed waitlist, no timeline to reopen.";
    case "wrong_provider":         return "Provider left practice. No forwarding information.";
    case "no_behavioral_health":   return "Listed in directory but no behavioral health services offered.";
    case "retired":                return "Retired. Practice closed to new patients.";
  }
}

export function realTranscript(
  providerName: string,
  carrier: string,
  careNeeds: string[],
  planType: string,
  rng: () => number,
): string {
  const plan = planLabel(planType, carrier);
  const need = careNeeds.length > 0 ? careNeeds[0].toLowerCase() : "outpatient therapy";
  return pickVariant(REAL_VARIANTS, rng)(providerName, plan, carrier, need);
}

export function realSummary(carrier: string, planType: string): string {
  const suffix =
    planType === "medicaid" ? " (Medicaid managed care)" :
    planType === "medicare" ? " (Medicare Advantage)" :
    planType === "employer" ? " (employer-sponsored)" : "";
  return `Confirmed in-network with ${carrier}${suffix}. Accepting new patients, availability within 1–2 weeks.`;
}

export function voicemailTranscript(
  providerName: string,
  carrier: string,
  careNeeds: string[],
  rng: () => number,
): string {
  const plan = planLabel("commercial", carrier); // voicemail doesn't vary by plan type
  const need = careNeeds.length > 0 ? careNeeds[0].toLowerCase() : "therapy";
  return pickVariant(VOICEMAIL_VARIANTS, rng)(providerName, plan, carrier, need);
}

export function voicemailSummary(): string {
  return "Voicemail reached. No confirmation of network status or availability.";
}
