// Best-effort date parsing for the CRM notification generator.
// The CRM tabs' due-date-like columns (`date`, `meetingScheduled`, `nextFollowUp`, `followUpDate`)
// are plain free-text inputs, not date pickers — so parsing is intentionally best-effort. Unparseable
// values are skipped (no notification generated) rather than guessed at.

const DMY_SEPARATED = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/;
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Try to extract a usable Date from a free-text field. Returns null if nothing date-like is found.
 * Handles ISO-ish strings, most formats `new Date()` understands, and common dd/mm/yyyy or
 * dd-mm-yyyy typed values (assumed day-first, matching the rest of this app's date inputs).
 */
export function parseLooseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const dmyMatch = text.match(DMY_SEPARATED);
  if (dmyMatch) {
    const [, dd, mm, yy] = dmyMatch;
    let year = parseInt(yy, 10);
    if (yy.length === 2) year += year < 70 ? 2000 : 1900;
    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // A bare "yyyy-MM-dd" is parsed by `new Date()` as UTC midnight (per spec), which shifts to the
  // previous day in any timezone behind UTC (e.g. IST) — parse it as LOCAL midnight instead.
  const isoMatch = text.match(ISO_DATE_ONLY);
  if (isoMatch) {
    const [, yy, mm, dd] = isoMatch;
    const d = new Date(
      parseInt(yy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Try to pull a leading date-like token out of longer free text (e.g. "01-Sep-2026 10:00 AM").
  const native = new Date(text);
  if (!Number.isNaN(native.getTime())) return native;

  return null;
}

/** Extracts a HH:MM-ish time string from free text, if present (e.g. "10:00 AM"). */
export function extractLooseTime(
  raw: string | undefined | null,
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\b/);
  return match ? match[1] : undefined;
}

export function todayStart(): Date {
  return startOfDay(new Date());
}

export function diffInDays(due: Date, from: Date = todayStart()): number {
  const a = startOfDay(due).getTime();
  const b = startOfDay(from).getTime();
  return Math.round((a - b) / 86400000);
}

export function toISO(d: Date): string {
  return toISODate(d);
}

/** Rough heuristic: does this status-ish text already indicate the activity is closed out? */
export function looksClosedOut(statusText: string | undefined | null): boolean {
  if (!statusText) return false;
  const s = statusText.toLowerCase();
  return [
    "done",
    "completed",
    "cancel",
    "happened",
    "closed",
    "not interested",
  ].some((kw) => s.includes(kw));
}
