const apiBase = import.meta.env.VITE_API_BASE ?? "";
const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (demoKey) h["X-Demo-Api-Key"] = demoKey;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function downloadPdf(path: string, filename: string): Promise<void> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: demoKey ? { "X-Demo-Api-Key": demoKey } : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type CallResult = {
  npi: string;
  phone: string;
  status: "real" | "ghost" | "voicemail" | "no_answer" | "error";
  ghost_reason?: string | null;
  transcript: string;
  summary?: string | null;
  provider_name?: string | null;
  specialty?: string | null;
  verified_at?: string | null;
  audio_note?: string | null;
};

export type AuditSummary = {
  audit_id: string;
  status: "running" | "completed" | "failed";
  carrier: string;
  zip_code: string;
  care_needs: string[];
  providers_total: number;
  calls_completed: number;
  ghost_count: number;
  real_count: number;
  voicemail_count: number;
  other_count: number;
  ghost_rate: number;
  voicemail_rate: number;
  complaint_eligible: boolean;
  top_providers: CallResult[];
  results: CallResult[];
  share_path: string;
  voice_mode: string;
  loop_agent_note?: string | null;
  rag_hits?: { source: string; excerpt: string; score: number }[];
};

export type EmployerDashboard = {
  title: string;
  ghost_rate_by_carrier: { carrier: string; ghost_rate: number }[];
  exposure_usd_per_untreated_annual: number;
  example_headcount: number;
  example_untreated_fraction: number;
  broken_specialties: {
    label: string;
    real_providers_within_25mi: number;
    employees_affected_estimate: number;
  }[];
  renewal_lever: string;
};
