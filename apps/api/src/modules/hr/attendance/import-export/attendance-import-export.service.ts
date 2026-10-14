import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { toCsv, parseCsv, CsvParseError } from "../../../../common/csv/csv.js";
import { formatDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import {
  AttendanceRepository,
  type ImportPunch,
} from "../attendance.repository.js";
import { assertRange } from "../attendance.service.js";
import type { RangeAttendanceReportQueryDto } from "../dto/attendance-report.dto.js";
import { AttendanceReportsService } from "../reports/attendance-reports.service.js";
import {
  EXPORT_HEADERS,
  MAX_EXPORT_ROWS,
  MAX_IMPORT_ROWS,
  mapImportHeader,
  parseImportRows,
  toExportRow,
  type ImportRowError,
} from "./attendance-csv.js";

export const EXPORT = "hr.attendance.export";
export const IMPORT = "hr.attendance.import";

/** Employees read per page while building an export. */
const EXPORT_PAGE = 100;

export interface AttendanceImportReport {
  dryRun: boolean;
  totalRows: number;
  /** Rows with no problem (on a failed or dry run, nothing was saved). */
  validRows: number;
  /** Sessions saved (0 on a dry run or when any row failed). */
  imported: number;
  /** Rows identical to a session already stored; skipped, not an error. */
  duplicates: number;
  errors: ImportRowError[];
}

/**
 * CSV export of derived attendance and CSV import of punch pairs
 * (Docs/HR_API.md → Attendance import / export). Both are team-scoped on
 * their own permissions; `.own` grants no import (nobody loads their own
 * punches) and an import row for the caller's own record is refused.
 */
@Injectable()
export class AttendanceImportExportService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly reports: AttendanceReportsService,
    private readonly teamContext: TeamContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** One row per employee per day in the range (unmarked days included),
   * with the same derived status and hours as every other screen. */
  async exportCsv(query: RangeAttendanceReportQueryDto): Promise<string> {
    assertRange(query.from, query.to);
    const scope = await this.teamContext.resolveScope(EXPORT);
    const rows: unknown[][] = [];
    for (let page = 1; ; page += 1) {
      const pagination = Object.assign(new PaginationDto(), {
        page,
        limit: EXPORT_PAGE,
      });
      const { employees, views, total } = await this.reports.daysForExport(
        scope,
        query,
        pagination,
      );
      const byId = new Map(employees.map((e) => [e.id, e]));
      for (const view of views) {
        rows.push(toExportRow(byId.get(view.employeeId)!, view));
        if (rows.length > MAX_EXPORT_ROWS) {
          throw new BusinessRuleViolationException(
            `The export would exceed ${MAX_EXPORT_ROWS} rows; narrow the dates, team or employee`,
            "EXPORT_TOO_LARGE",
          );
        }
      }
      if (page * EXPORT_PAGE >= total) break;
    }
    return toCsv(EXPORT_HEADERS, rows);
  }

  async importCsv(
    file: { buffer: Buffer } | undefined,
    dryRun: boolean,
  ): Promise<AttendanceImportReport> {
    const scope = await this.teamContext.resolveScope(IMPORT);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not import attendance");
    }
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException("Attach a CSV file in the field 'file'");
    }
    let table: string[][];
    try {
      table = parseCsv(file.buffer.toString("utf8"));
    } catch (error) {
      throw new BadRequestException(
        error instanceof CsvParseError ? error.message : "Unreadable CSV file",
      );
    }
    const [header, ...data] = table;
    if (!header || data.length === 0) {
      throw new BadRequestException(
        "The file needs a header row and at least one punch row",
      );
    }
    if (data.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `At most ${MAX_IMPORT_ROWS} rows per import (this file has ${data.length})`,
      );
    }
    const mapped = mapImportHeader(header);
    if (mapped.errors.length > 0) throw new BadRequestException(mapped.errors);

    const parsed = parseImportRows(data, mapped.index, new Date());
    const errors = [...parsed.errors];

    // Match codes to employees inside the caller's import scope.
    const codes = [...new Set(parsed.rows.map((r) => r.employeeCode))];
    const employees = await this.repository.findImportEmployees(scope, codes);
    const byCode = new Map(
      employees.map((e) => [e.employeeCode.toUpperCase(), e]),
    );
    const userId = this.tenantContext.getUserId();
    const punches: ImportPunch[] = [];
    for (const r of parsed.rows) {
      const employee = byCode.get(r.employeeCode);
      if (!employee) {
        errors.push({
          row: r.row,
          field: "Employee Code",
          message: `No employee ${r.employeeCode} in your scope`,
        });
        continue;
      }
      if (employee.userId === userId) {
        errors.push({
          row: r.row,
          field: "Employee Code",
          message: "You cannot import punches for yourself",
        });
        continue;
      }
      const joined = formatDateOnly(employee.dateOfJoining);
      const exited = employee.dateOfExit
        ? formatDateOnly(employee.dateOfExit)
        : null;
      if (r.date < joined || (exited !== null && r.date > exited)) {
        errors.push({
          row: r.row,
          field: "Date",
          message: "The employee was not employed on this date",
        });
        continue;
      }
      punches.push({
        row: r.row,
        employeeId: employee.id,
        date: r.date,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
      });
    }

    // The database checks run even when the file already has errors, so the
    // report lists every problem at once; nothing is saved in that case.
    const batch = await this.repository.importBatch(
      this.tenantContext.getOrgScope(),
      punches,
      userId,
      dryRun || errors.length > 0,
    );
    errors.push(...batch.errors);
    const failedRows = new Set(errors.map((e) => e.row));
    const saved = !dryRun && errors.length === 0;
    return {
      dryRun,
      totalRows: data.length,
      validRows: data.length - failedRows.size,
      imported: saved ? batch.created : 0,
      duplicates: batch.duplicates,
      errors: errors.sort((a, b) => a.row - b.row),
    };
  }
}
