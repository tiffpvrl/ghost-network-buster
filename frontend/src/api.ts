const apiBase = import.meta.env.VITE_API_BASE ?? "";
const demoKey = import.meta.env.VITE_DEMO_API_KEY ?? "";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (demoKey) h["X-Demo-Api-Key"] = demoKey;
  return h;
}

/** Parse FastAPI-style JSON error bodies */
function parseErrorDetail(text: string, status: number): string {
  if (!text?.trim()) return `Request failed (${status})`;
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) return String((item as { msg: string }).msg);
          return JSON.stringify(item);
        })
        .join(" ");
    }
  } catch {
    /* use raw */
  }
  return text;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? parseErrorDetail(body, status));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Human-friendly copy for common HTTP statuses (UI layer can override per page). */
export function friendlyHttpMessage(status: number): string | null {
  if (status === 410) return "This results link has expired or is no longer available.";
  /** if (status === 401) return "Could not authorize — check your API key matches the server."; */
  return null;
}

function throwApiError(res: Response, text: string): never {
  throw new ApiError(res.status, text);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, { headers: headers() });
  const text = await res.text();
  if (!res.ok) throwApiError(res, text);
  return JSON.parse(text) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throwApiError(res, text);
  return JSON.parse(text) as T;
}

export async function downloadPdf(path: string, filename: string): Promise<void> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: demoKey ? { "X-Demo-Api-Key": demoKey } : undefined,
  });
  const text = res.ok ? "" : await res.text();
  if (!res.ok) throwApiError(res, text);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type PlanType = "commercial" | "medicaid" | "medicare" | "employer" | "unsure";

export type ProvidersPreview = { count: number; max_providers: number | null };

export async function apiProvidersPreview(maxProviders?: number | null): Promise<ProvidersPreview> {
  const q = maxProviders != null ? `?max_providers=${maxProviders}` : "";
  return apiGet<ProvidersPreview>(`/api/providers-preview${q}`);
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
  plan_type?: string | null;
  member_plan_label?: string | null;
  recording_consent?: boolean;
  terms_acknowledged?: boolean;
  started_at?: string | null;
  completed_at?: string | null;
  providers_total: number;
  calls_completed: number;
  ghost_count: number;
  real_count: number;
  voicemail_count: number;
  other_count: number;
  ghost_rate: number;
  voicemail_rate: number;
  high_ghost_rate: boolean;
  complaint_eligible: boolean;
  top_providers: CallResult[];
  results: CallResult[];
  error?: string | null;
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
