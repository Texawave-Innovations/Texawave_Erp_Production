import type { EffectiveStatus } from "../services/attendance-calculation.service.js";

/**
 * Pure CSV rules for attendance export and punch import (Docs/HR_API.md →
 * Attendance import / export). No database or clock access.
 */

/** Most punch rows one import may carry (one transaction holds them all):
 * a month for ~190 employees at one punch pair a day. */
export const MAX_IMPORT_ROWS = 5000;
/** A 5,000-row punch file is far below this. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
/** Most rows one export returns (employees × days); narrow beyond this. */
export const MAX_EXPORT_ROWS = 50_000;

// ---- export -----------------------------------------------------------------

export const EXPORT_HEADERS = [
  "Employee Code",
  "Full Name",
  "Date",
  "Day",
  "Status",
  "First Check In",
  "Last Check Out",
  "Sessions",
  "Worked Hours",
  "Overtime Hours",
  "Shortfall Hours",
] as const;

const IST_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface ExportDay {
  attendanceDate: string;
  status: EffectiveStatus;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  sessions: readonly { checkInAt: Date; checkOutAt: Date | null }[];
}

const hours = (minutes: number) => (minutes / 60).toFixed(2);

export function toExportRow(
  employee: { employeeCode: string; fullName: string },
  day: ExportDay,
): unknown[] {
  const first = day.sessions[0];
  const last = day.sessions[day.sessions.length - 1];
  const weekday =
    (new Date(`${day.attendanceDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  return [
    employee.employeeCode,
    employee.fullName,
    day.attendanceDate,
    WEEKDAY[weekday],
    day.status,
    first ? IST_TIME.format(first.checkInAt) : "",
    last?.checkOutAt ? IST_TIME.format(last.checkOutAt) : "",
    day.sessions.length,
    hours(day.workedMinutes),
    hours(day.overtimeMinutes),
    hours(day.shortfallMinutes),
  ];
}

// ---- import -----------------------------------------------------------------

type ImportField = "employeeCode" | "date" | "checkIn" | "checkOut";

/** Header → field. The aliases cover the column names common biometric
 * exports use, so most files import without renaming columns. Matching
 * ignores case, spaces, dots, dashes and underscores. */
const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  employeeCode: ["employeecode", "empcode", "employeeid", "empid", "code"],
  date: ["date", "attendancedate", "punchdate", "workdate"],
  checkIn: ["checkin", "intime", "in", "punchin", "timein", "firstin"],
  checkOut: ["checkout", "outtime", "out", "punchout", "timeout", "lastout"],
};
/** Export-only columns accepted in the header and ignored, so a file built
 * from an export only needs Check In / Check Out columns added. */
const IGNORED = new Set([
  "fullname",
  "name",
  "employeename",
  "day",
  "status",
  "firstcheckin",
  "lastcheckout",
  "sessions",
  "workedhours",
  "overtimehours",
  "shortfallhours",
]);

const normalise = (header: string) =>
  header.toLowerCase().replace(/[\s._-]/g, "");

export function mapImportHeader(header: string[]): {
  index: Partial<Record<ImportField, number>>;
  errors: string[];
} {
  const index: Partial<Record<ImportField, number>> = {};
  const errors: string[] = [];
  header.forEach((raw, i) => {
    const key = normalise(raw);
    if (key === "" || IGNORED.has(key)) return;
    // "First Check In" / "Last Check Out" are export columns, handled above.
    const field = (Object.keys(HEADER_ALIASES) as ImportField[]).find((f) =>
      HEADER_ALIASES[f].includes(key),
    );
    if (!field) {
      errors.push(`Unknown column "${raw.trim()}"`);
    } else if (index[field] !== undefined) {
      errors.push(`Column "${raw.trim()}" appears more than once`);
    } else {
      index[field] = i;
    }
  });
  const labels: Record<ImportField, string> = {
    employeeCode: "Employee Code",
    date: "Date",
    checkIn: "Check In",
    checkOut: "Check Out",
  };
  for (const field of Object.keys(labels) as ImportField[]) {
    if (index[field] === undefined) {
      errors.push(`Missing required column "${labels[field]}"`);
    }
  }
  return { index, errors };
}

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ParsedPunch {
  /** File row number; the header is row 1. */
  row: number;
  employeeCode: string;
  date: string;
  checkInAt: Date;
  checkOutAt: Date;
}

/** `2026-09-17`, `17-09-2026` or `17/09/2026` → `2026-09-17`; null if not a
 * real calendar date. Day-first, as Indian biometric exports write it. */
export function parseImportDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(v);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** `09:05`, `9:05:30`, `9:05 AM` → minutes after midnight; null if invalid. */
export function parseImportTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2]);
  const meridiem = match[4]?.toUpperCase();
  if (min > 59 || (match[3] !== undefined && Number(match[3]) > 59)) {
    return null;
  }
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem === "PM" ? 12 : 0);
  } else if (h > 23) {
    return null;
  }
  return h * 60 + min;
}

/** The instant of `minutes` after midnight IST on `date`. */
export function istInstant(date: string, minutes: number): Date {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00+05:30`);
}

/** A leading `'` is how our export (and Excel) protects formula-like text. */
function cell(row: string[], i: number | undefined): string {
  if (i === undefined) return "";
  return (row[i] ?? "").trim().replace(/^'(?=[=+\-@])/, "");
}

/**
 * Turns data rows into punch pairs, checking everything that needs no
 * database: required cells, date and time formats, check-out after check-in
 * on the same day (overnight pairs are not supported), no future punch, and
 * no two rows of one employee overlapping on one day.
 */
export function parseImportRows(
  data: string[][],
  index: Partial<Record<ImportField, number>>,
  now: Date,
): { rows: ParsedPunch[]; errors: ImportRowError[] } {
  const rows: ParsedPunch[] = [];
  const errors: ImportRowError[] = [];
  data.forEach((raw, i) => {
    const row = i + 2;
    const code = cell(raw, index.employeeCode).toUpperCase();
    const dateText = cell(raw, index.date);
    const inText = cell(raw, index.checkIn);
    const outText = cell(raw, index.checkOut);
    const before = errors.length;

    if (!code)
      errors.push({ row, field: "Employee Code", message: "Required" });
    const date = dateText ? parseImportDate(dateText) : null;
    if (!dateText) errors.push({ row, field: "Date", message: "Required" });
    else if (!date) {
      errors.push({
        row,
        field: "Date",
        message: "Use YYYY-MM-DD or DD-MM-YYYY",
      });
    }
    const inMin = inText ? parseImportTime(inText) : null;
    const outMin = outText ? parseImportTime(outText) : null;
    if (!inText) errors.push({ row, field: "Check In", message: "Required" });
    else if (inMin === null) {
      errors.push({
        row,
        field: "Check In",
        message: "Use HH:mm (24-hour) or h:mm AM",
      });
    }
    if (!outText) {
      errors.push({
        row,
        field: "Check Out",
        message: "Required (an import cannot leave a session open)",
      });
    } else if (outMin === null) {
      errors.push({
        row,
        field: "Check Out",
        message: "Use HH:mm (24-hour) or h:mm AM",
      });
    }
    if (errors.length > before || !date || inMin === null || outMin === null) {
      return;
    }
    if (outMin <= inMin) {
      errors.push({
        row,
        field: "Check Out",
        message:
          "Check-out must be after check-in on the same day (overnight pairs are not supported)",
      });
      return;
    }
    const checkInAt = istInstant(date, inMin);
    const checkOutAt = istInstant(date, outMin);
    if (checkOutAt.getTime() > now.getTime()) {
      errors.push({
        row,
        field: "Check Out",
        message: "Punches cannot be in the future",
      });
      return;
    }
    rows.push({ row, employeeCode: code, date, checkInAt, checkOutAt });
  });

  // Overlap between rows of the same employee and day (touching is fine).
  const groups = new Map<string, ParsedPunch[]>();
  for (const p of rows) {
    const key = `${p.employeeCode}|${p.date}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  const overlapping = new Set<number>();
  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) => a.checkInAt.getTime() - b.checkInAt.getTime(),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.checkInAt.getTime() < prev.checkOutAt.getTime()) {
        overlapping.add(cur.row);
        errors.push({
          row: cur.row,
          field: "Check In",
          message: `Overlaps row ${prev.row} for the same employee and date`,
        });
      }
    }
  }
  return { rows: rows.filter((r) => !overlapping.has(r.row)), errors };
}

/** Whether two punch pairs overlap; an open pair runs to the end of time. */
export function overlaps(
  a: { checkInAt: Date; checkOutAt: Date | null },
  b: { checkInAt: Date; checkOutAt: Date | null },
): boolean {
  const aEnd = a.checkOutAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.checkOutAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.checkInAt.getTime() < bEnd && b.checkInAt.getTime() < aEnd;
}
