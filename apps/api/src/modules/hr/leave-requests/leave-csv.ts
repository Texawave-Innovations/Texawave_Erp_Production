import type {
  EmployeeBalanceRow,
  LeaveRequestView,
} from "./leave-requests.repository.js";

/**
 * Pure CSV rules for leave export and entitlement import (Docs/HR_API.md →
 * Leave export / import). No database or clock access. Files are written and
 * read with `common/csv` (RFC 4180, opened and saved natively by Excel).
 */

/** Most rows one export returns; narrow the filters beyond this. */
export const MAX_EXPORT_ROWS = 50_000;
/** Most rows one entitlement import may carry (one transaction holds them). */
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export const REQUEST_EXPORT_HEADERS = [
  "Employee Code",
  "Employee",
  "Leave Type",
  "From",
  "To",
  "Portion",
  "Days",
  "Reason",
  "Status",
  "Requested By",
  "First Approval By",
  "Decided By",
  "Decided At",
  "Decision Note",
  "Cancelled By",
  "Cancellation Note",
  "Applied On",
] as const;

export function requestExportRow(v: LeaveRequestView): unknown[] {
  return [
    v.employee.employeeCode,
    v.employee.fullName,
    v.leaveType.name,
    v.startDate,
    v.endDate,
    v.dayPortion,
    v.leaveDays,
    v.reason,
    v.status,
    v.requestedBy.fullName,
    v.firstDecidedBy?.fullName ?? "",
    v.decidedBy?.fullName ?? "",
    v.decidedAt ?? "",
    v.decisionNote ?? "",
    v.cancelledBy?.fullName ?? "",
    v.cancellationNote ?? "",
    v.createdAt,
  ];
}

export const BALANCE_EXPORT_HEADERS = [
  "Employee Code",
  "Employee",
  "Year",
  "Leave Type Code",
  "Leave Type",
  "Paid",
  "Allotment",
  "Annual Entitlement",
  "Opening",
  "Accrued",
  "Used",
  "Pending",
  "Available",
] as const;

export function balanceExportRows(row: EmployeeBalanceRow): unknown[][] {
  return row.balances.map((b) => [
    row.employee.employeeCode,
    row.employee.fullName,
    b.year,
    b.code,
    b.name,
    b.isPaid ? "Yes" : "No",
    b.isOverride ? "Custom" : "Default",
    b.entitlement,
    b.opening,
    b.accrued,
    b.used,
    b.pending,
    b.available ?? "",
  ]);
}

// ---- entitlement import -----------------------------------------------------

export const ENTITLEMENT_IMPORT_HEADERS = [
  "Employee Code",
  "Leave Type Code",
  "Year",
  "Annual Entitlement",
] as const;

export interface ImportRowError {
  /** 1-based line number in the file (the header is line 1). */
  row: number;
  message: string;
}

export interface ParsedEntitlement {
  row: number;
  employeeCode: string;
  leaveTypeCode: string;
  year: number;
  /** null = remove the override (blank cell). */
  annualEntitlement: number | null;
}

const normalise = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

/** Column index of each required header (any order, any case), or the
 * headers that are missing. */
export function mapEntitlementHeader(header: string[]):
  | {
      ok: true;
      index: Record<(typeof ENTITLEMENT_IMPORT_HEADERS)[number], number>;
    }
  | { ok: false; missing: string[] } {
  const positions = header.map(normalise);
  const index = {} as Record<
    (typeof ENTITLEMENT_IMPORT_HEADERS)[number],
    number
  >;
  const missing: string[] = [];
  for (const name of ENTITLEMENT_IMPORT_HEADERS) {
    const at = positions.indexOf(normalise(name));
    if (at < 0) missing.push(name);
    else index[name] = at;
  }
  return missing.length ? { ok: false, missing } : { ok: true, index };
}

/**
 * Parses data rows into entitlements, collecting every problem with its line
 * number rather than stopping at the first. A blank entitlement clears the
 * override; a number must be 0–366 with at most one decimal. The same
 * employee, type and year twice in one file is an error (which one wins
 * would be ambiguous).
 */
export function parseEntitlementRows(
  rows: string[][],
  index: Record<(typeof ENTITLEMENT_IMPORT_HEADERS)[number], number>,
): { parsed: ParsedEntitlement[]; errors: ImportRowError[] } {
  const parsed: ParsedEntitlement[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Map<string, number>();
  rows.forEach((cells, i) => {
    const row = i + 2;
    const cell = (name: (typeof ENTITLEMENT_IMPORT_HEADERS)[number]) =>
      (cells[index[name]] ?? "").trim();
    const employeeCode = cell("Employee Code").toUpperCase();
    const leaveTypeCode = cell("Leave Type Code").toUpperCase();
    const yearText = cell("Year");
    const valueText = cell("Annual Entitlement");
    const problems: string[] = [];
    if (!employeeCode) problems.push("Employee Code is empty");
    if (!leaveTypeCode) problems.push("Leave Type Code is empty");
    const year = Number(yearText);
    if (!/^\d{4}$/.test(yearText) || year < 2000 || year > 2200) {
      problems.push(`Year "${yearText}" must be a year between 2000 and 2200`);
    }
    let value: number | null = null;
    if (valueText !== "") {
      value = Number(valueText);
      if (
        !/^\d+(\.\d)?$/.test(valueText) ||
        !Number.isFinite(value) ||
        value > 366
      ) {
        problems.push(
          `Annual Entitlement "${valueText}" must be 0–366 with at most one decimal, or blank to remove the override`,
        );
      }
    }
    if (problems.length) {
      errors.push({ row, message: problems.join("; ") });
      return;
    }
    const key = `${employeeCode}|${leaveTypeCode}|${year}`;
    const first = seen.get(key);
    if (first !== undefined) {
      errors.push({
        row,
        message: `Repeats line ${first} (same employee, leave type and year)`,
      });
      return;
    }
    seen.set(key, row);
    parsed.push({
      row,
      employeeCode,
      leaveTypeCode,
      year,
      annualEntitlement: value,
    });
  });
  return { parsed, errors };
}
