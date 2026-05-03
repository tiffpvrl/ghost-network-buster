// localStorage helpers for employer audit batches.
// A "batch" is a fan-out of N children audits (one per carrier × ZIP pair),
// each backed by a real /api/start-audit response.

const STORAGE_KEY = "gnb_employer_batches";

export type BatchAuditChild = {
  id: string;          // audit_id from backend
  carrier: string;
  zip: string;
};

export type EmployerBatch = {
  id: string;          // batch_id (client-generated UUID)
  createdAt: string;   // ISO timestamp
  carriers: string[];
  zips: string[];
  audits: BatchAuditChild[];
  status: "running" | "completed" | "failed";
};

type BatchMap = Record<string, EmployerBatch>;

function readMap(): BatchMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BatchMap | null;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(map: BatchMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function loadBatch(id: string): EmployerBatch | null {
  return readMap()[id] ?? null;
}

export function saveBatch(batch: EmployerBatch): void {
  const map = readMap();
  map[batch.id] = batch;
  writeMap(map);
}

export function listByCreatedAt(): EmployerBatch[] {
  const map = readMap();
  return Object.values(map).sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0,
  );
}

export function updateBatchStatus(id: string, status: EmployerBatch["status"]): void {
  const map = readMap();
  const cur = map[id];
  if (!cur) return;
  map[id] = { ...cur, status };
  writeMap(map);
}
