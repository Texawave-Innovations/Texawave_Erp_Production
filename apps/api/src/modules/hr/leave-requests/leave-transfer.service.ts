import { BadRequestException, Injectable } from "@nestjs/common";
import { CsvParseError, parseCsv, toCsv } from "../../../common/csv/csv.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  BulkSetLeaveEntitlementsDto,
  ExportLeaveRequestQueryDto,
  LeaveBalanceReportQueryDto,
} from "./dto/leave-request.dto.js";
import {
  BALANCE_EXPORT_HEADERS,
  balanceExportRows,
  type ImportRowError,
  mapEntitlementHeader,
  MAX_EXPORT_ROWS,
  MAX_IMPORT_ROWS,
  parseEntitlementRows,
  REQUEST_EXPORT_HEADERS,
  requestExportRow,
} from "./leave-csv.js";
import { LeaveRequestsRepository, today } from "./leave-requests.repository.js";
import { READ } from "./leave-requests.service.js";

export const EXPORT = "hr.leave_request.export";

/** Employees per page while building a balance export. */
const EXPORT_PAGE = 100;

export interface EntitlementImportReport {
  dryRun: boolean;
  totalRows: number;
  /** Rows with no problem (on a failed or dry run, nothing was saved). */
  validRows: number;
  /** Entitlements written (0 on a dry run or when any row failed). */
  imported: number;
  errors: ImportRowError[];
}

/**
 * Leave reports, CSV export, and bulk entitlement administration
 * (Docs/HR_API.md → Leave export / import).
 *
 * RBAC: the balance report reads within `hr.leave_request.read`; both CSV
 * exports within `hr.leave_request.export` (own/team/all — an export never
 * reaches past what the caller could read row by row); bulk set and import
 * are entitlement administration, gated by `hr.leave_type.write` at the
 * controller like the single-entitlement route (Docs/HR_LEAVE.md D11).
 */
@Injectable()
export class LeaveTransferService {
  constructor(
    private readonly repository: LeaveRequestsRepository,
    private readonly teamContext: TeamContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async exportRequests(query: ExportLeaveRequestQueryDto): Promise<string> {
    const scope = await this.teamContext.resolveScope(EXPORT);
    const views = await this.repository.findForExport(
      scope,
      query,
      MAX_EXPORT_ROWS,
    );
    if (views.length > MAX_EXPORT_ROWS) {
      throw new BusinessRuleViolationException(
        `The export would exceed ${MAX_EXPORT_ROWS} rows; narrow the dates, status, type or employee`,
        "EXPORT_TOO_LARGE",
      );
    }
    return toCsv(REQUEST_EXPORT_HEADERS, views.map(requestExportRow));
  }

  async balanceReport(query: LeaveBalanceReportQueryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.balanceReport(
      scope,
      { teamId: query.teamId, search: query.search },
      query.year ?? Number(today().slice(0, 4)),
      today(),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async exportBalances(query: LeaveBalanceReportQueryDto): Promise<string> {
    const scope = await this.teamContext.resolveScope(EXPORT);
    const year = query.year ?? Number(today().slice(0, 4));
    const rows: unknown[][] = [];
    for (let page = 1; ; page += 1) {
      const pagination = Object.assign(new PaginationDto(), {
        page,
        limit: EXPORT_PAGE,
      });
      const { items, total } = await this.repository.balanceReport(
        scope,
        { teamId: query.teamId, search: query.search },
        year,
        today(),
        pagination,
      );
      for (const item of items) rows.push(...balanceExportRows(item));
      if (rows.length > MAX_EXPORT_ROWS) {
        throw new BusinessRuleViolationException(
          `The export would exceed ${MAX_EXPORT_ROWS} rows; narrow the team or search`,
          "EXPORT_TOO_LARGE",
        );
      }
      if (page * EXPORT_PAGE >= total) break;
    }
    return toCsv(BALANCE_EXPORT_HEADERS, rows);
  }

  /** All or nothing: one bad item (unknown employee or type) fails the batch. */
  async setEntitlements(dto: BulkSetLeaveEntitlementsDto) {
    const items = await this.repository.setEntitlements(
      this.tenantContext.getOrgScope(),
      dto.items.map((i) => ({
        employeeId: i.employeeId,
        leaveTypeId: i.leaveTypeId,
        year: i.year,
        annualEntitlement: i.annualEntitlement,
      })),
      this.tenantContext.getUserId(),
    );
    return { updated: items.length, items };
  }

  /**
   * Entitlements from a CSV (Employee Code, Leave Type Code, Year, Annual
   * Entitlement — blank removes the override). Every row is checked first,
   * including unknown codes; any error saves nothing. `dryRun` checks only.
   */
  async importEntitlements(
    file: { buffer: Buffer } | undefined,
    dryRun: boolean,
  ): Promise<EntitlementImportReport> {
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
        "The file needs a header row and at least one entitlement row",
      );
    }
    if (data.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `At most ${MAX_IMPORT_ROWS} rows per import (this file has ${data.length})`,
      );
    }
    const mapped = mapEntitlementHeader(header);
    if (!mapped.ok) {
      throw new BadRequestException(
        `Missing column(s): ${mapped.missing.join(", ")}`,
      );
    }
    const { parsed, errors } = parseEntitlementRows(data, mapped.index);

    const scope = this.tenantContext.getOrgScope();
    const [employees, types] = await Promise.all([
      this.repository.employeeIdsByCode(scope, [
        ...new Set(parsed.map((p) => p.employeeCode)),
      ]),
      this.repository.leaveTypeIdsByCode(scope),
    ]);
    const items: {
      employeeId: number;
      leaveTypeId: number;
      year: number;
      annualEntitlement: number | null;
    }[] = [];
    for (const p of parsed) {
      const employeeId = employees.get(p.employeeCode);
      const leaveTypeId = types.get(p.leaveTypeCode);
      const problems: string[] = [];
      if (employeeId === undefined)
        problems.push(`Unknown employee code "${p.employeeCode}"`);
      if (leaveTypeId === undefined)
        problems.push(`Unknown leave type code "${p.leaveTypeCode}"`);
      if (
        problems.length ||
        employeeId === undefined ||
        leaveTypeId === undefined
      ) {
        errors.push({ row: p.row, message: problems.join("; ") });
        continue;
      }
      items.push({
        employeeId,
        leaveTypeId,
        year: p.year,
        annualEntitlement: p.annualEntitlement,
      });
    }
    errors.sort((a, b) => a.row - b.row);
    const report: EntitlementImportReport = {
      dryRun,
      totalRows: data.length,
      validRows: items.length,
      imported: 0,
      errors,
    };
    if (dryRun || errors.length > 0) return report;
    const written = await this.repository.setEntitlements(
      scope,
      items,
      this.tenantContext.getUserId(),
    );
    return { ...report, imported: written.length };
  }
}
