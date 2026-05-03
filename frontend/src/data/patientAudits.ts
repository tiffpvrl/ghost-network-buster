// localStorage helpers for patient audit history.
// Each entry is a single audit a logged-in patient has run from their workspace.

const STORAGE_KEY = "gnb_patient_audits";

export type PatientAuditStatus = "running" | "completed" | "failed";

export type PatientAuditRecord = {
  id: string;
  createdAt: string;
  carrier: string;
  zip: string;
  planType: string;
  careNeeds: string[];
  latestStatus: PatientAuditStatus;
  ghostRate: number | null;
  realCount: number | null;
  completedAt: string | null;
};

type PatientAuditMap = Record<string, PatientAuditRecord>;

function readMap(): PatientAuditMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PatientAuditMap | null;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(map: PatientAuditMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function recordPatientAudit(
  input: Omit<PatientAuditRecord, "createdAt" | "ghostRate" | "realCount" | "completedAt"> &
    Partial<Pick<PatientAuditRecord, "createdAt" | "ghostRate" | "realCount" | "completedAt">>,
): PatientAuditRecord {
  const map = readMap();
  const record: PatientAuditRecord = {
    createdAt: new Date().toISOString(),
    ghostRate: null,
    realCount: null,
    completedAt: null,
    ...input,
  };
  map[record.id] = record;
  writeMap(map);
  return record;
}

export function updatePatientAudit(
  id: string,
  patch: Partial<PatientAuditRecord>,
): PatientAuditRecord | null {
  const map = readMap();
  const cur = map[id];
  if (!cur) return null;
  const next: PatientAuditRecord = { ...cur, ...patch };
  map[id] = next;
  writeMap(map);
  return next;
}

export function loadPatientAudit(id: string): PatientAuditRecord | null {
  return readMap()[id] ?? null;
}

export function listPatientAuditsByCreatedAt(): PatientAuditRecord[] {
  const map = readMap();
  return Object.values(map).sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0,
  );
}
