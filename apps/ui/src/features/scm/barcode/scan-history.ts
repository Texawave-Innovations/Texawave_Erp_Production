// Scan history — session-local only (sessionStorage): the barcode workspace's
// "Recent scans". Nothing is stored server-side.
import type { ScmScanType } from "@texawave-erp/api-types";

export type ScanSource =
  "GLOBAL" | "PRODUCT" | "LOCATION" | "BATCH" | "SERIAL" | "DOCUMENT" | "TYPED";

export interface ScanHistoryEntry {
  id: string;
  code: string;
  type: ScmScanType;
  label: string;
  viewPath?: string | undefined;
  source: ScanSource;
  time: number;
}

const KEY = "scm.barcode.scanHistory.v1";
const LIMIT = 50;

export function getScanHistory(): ScanHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: ScanHistoryEntry[]): ScanHistoryEntry[] {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — history just will not persist */
  }
  return entries;
}

export function addScanHistoryEntry(
  entry: Omit<ScanHistoryEntry, "id" | "time">,
): ScanHistoryEntry[] {
  const next: ScanHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: Date.now(),
  };
  return save([next, ...getScanHistory()].slice(0, LIMIT));
}

export function removeScanHistoryEntry(id: string): ScanHistoryEntry[] {
  return save(getScanHistory().filter((e) => e.id !== id));
}

export function clearScanHistory(): ScanHistoryEntry[] {
  return save([]);
}
