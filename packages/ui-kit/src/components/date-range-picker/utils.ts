export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const WEEKDAY_NAMES_SHORT = [
  "Su",
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
] as const;

/** Format a Date object to YYYY-MM-DD in local time */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string into a Date in local time without timezone skew */
export function parseDateISO(str: string | undefined): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const parts = str.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

/** Format YYYY-MM-DD to human-readable format: "09 Oct 2026" */
export function formatDisplayDate(str: string | undefined): string {
  if (!str) return "";
  const d = parseDateISO(str);
  if (!d) return str;
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTH_NAMES_SHORT[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/** Number of days in a given month */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Day of week of the 1st day of the month (0 = Sunday, 1 = Monday ...) */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Calculate date span count in days */
export function countDays(fromStr: string, toStr: string): number {
  const f = parseDateISO(fromStr);
  const t = parseDateISO(toStr);
  if (!f || !t) return 0;
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1);
}

export interface PresetRange {
  label: string;
  getRange: () => { from: string; to: string };
}

/** Standard enterprise presets */
export const DEFAULT_DATE_PRESETS: PresetRange[] = [
  {
    label: "Today",
    getRange: () => {
      const now = new Date();
      const iso = formatDateISO(now);
      return { from: iso, to: iso };
    },
  },
  {
    label: "Yesterday",
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const iso = formatDateISO(d);
      return { from: iso, to: iso };
    },
  },
  {
    label: "This Week",
    getRange: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      return { from: formatDateISO(start), to: formatDateISO(now) };
    },
  },
  {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateISO(start), to: formatDateISO(now) };
    },
  },
  {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: formatDateISO(start), to: formatDateISO(end) };
    },
  },
  {
    label: "Last 30 Days",
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return { from: formatDateISO(start), to: formatDateISO(now) };
    },
  },
];
