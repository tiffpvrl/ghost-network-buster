import type { CallResult } from "./api";

const GHOST_REASON_LABELS: Record<string, string> = {
  disconnected: "Disconnected",
  wrong_network: "Wrong insurance",
  no_behavioral_health: "No BH services",
  not_accepting_patients: "Not accepting",
  wrong_provider: "Wrong number",
  retired: "Retired / moved",
  wrong_specialty: "Wrong specialty",
  referral_only: "Referral only",
};

/** Short labels (dashboard tiles). */
export function ghostReasonLabelShort(r?: string | null): string {
  return r ? (GHOST_REASON_LABELS[r] ?? r) : "";
}

/** Longer labels (results / print). */
export function ghostReasonLabelLong(r?: string | null): string {
  const map: Record<string, string> = {
    ...GHOST_REASON_LABELS,
    disconnected: "Disconnected number",
    not_accepting_patients: "Not accepting patients",
    wrong_provider: "Wrong number / person",
  };
  return r ? (map[r] ?? r) : "";
}

export function statusIconTitle(status: CallResult["status"]): string {
  if (status === "real") return "Verified usable listing";
  if (status === "ghost") return "Ghost or unusable listing";
  if (status === "voicemail") return "Voicemail — not confirmed";
  if (status === "no_answer") return "No answer";
  return "Error";
}
