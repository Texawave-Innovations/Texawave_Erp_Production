import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { CsvParseError, parseCsv, toCsv } from "../../../common/csv/csv.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import type { QueryEmployeeDto } from "./dto/query-employee.dto.js";
import type { UpdateEmployeeDto } from "./dto/update-employee.dto.js";
import {
  EXPORT_HEADERS,
  type ImportRowError,
  MAX_EXPORT_ROWS,
  MAX_IMPORT_ROWS,
  mapHeader,
  parseImportRows,
  toExportRow,
} from "./employee-csv.js";
import { toDetail, toListItem } from "./employee-mappers.js";
import {
  type EmployeeFilter,
  EmployeesRepository,
} from "./employees.repository.js";
import type { ReviewDecision } from "./onboarding-review.policy.js";

const READ = "hr.employee.read";
const WRITE = "hr.employee.write";
const EXPORT = "hr.employee.export";
const APPROVE_ONBOARDING = "hr.employee_onboarding.approve";

/** Fields only an `.all` writer may change: they move a person across the
 * team access boundary or alter their contractual/employment record. */
const ALL_ONLY_FIELDS = [
  "teamId",
  "departmentId",
  "designationId",
  "employmentTypeId",
  "dateOfJoining",
  "probationEndDate",
  "confirmationDate",
] as const;

export interface EmployeeImportReport {
  dryRun: boolean;
  totalRows: number;
  /** Rows that passed every check (all of them, when `errors` is empty). */
  validRows: number;
  /** Filled only when the import committed (not a dry run, no errors). */
  created: Array<{ row: number; id: number; employeeCode: string }>;
  errors: Array<ImportRowError & { errorCode?: string }>;
}

function toFilter(query: QueryEmployeeDto): EmployeeFilter {
  return {
    search: query.search,
    status: query.status,
    onboardingStatus: query.onboardingStatus,
    onboardingReviewStatus: query.onboardingReviewStatus,
    teamId: query.teamId,
    departmentId: query.departmentId,
    designationId: query.designationId,
    employmentTypeId: query.employmentTypeId,
    workLocationId: query.workLocationId,
    reportsToId: query.reportsToId,
    hasUser: query.hasUser,
    joinedFrom: query.joinedFrom,
    joinedTo: query.joinedTo,
    sortBy: query.sortBy,
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryEmployeeDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      toFilter(query),
      query,
    );
    return new PaginatedResponseDto(
      items.map(toListItem),
      total,
      query.page,
      query.limit,
    );
  }

  /** 404 — not 403 — for an employee outside the caller's scope, so the
   * existence of records the caller may not see is not disclosed. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  async create(dto: CreateEmployeeDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not create employees");
    }
    if (scope.level === "team" && !scope.teamIds.includes(dto.teamId)) {
      throw new ForbiddenException(
        "You may create employees only in your own team(s)",
      );
    }
    const row = await this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
    return toDetail(row);
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      // Self-service profile edits are not part of the approved scope.
      throw new ForbiddenException("You may not edit employee records");
    }
    if (scope.level === "team") {
      const restricted = ALL_ONLY_FIELDS.filter((f) => dto[f] !== undefined);
      if (restricted.length > 0) {
        throw new ForbiddenException(
          `Only organization-wide HR may change: ${restricted.join(", ")}`,
        );
      }
    }
    const row = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  /** Counts for the directory's stats cards, within the caller's read scope. */
  async stats() {
    const scope = await this.teamContext.resolveScope(READ);
    return this.repository.stats(scope, new Date());
  }

  /**
   * CSV of the directory, same filters as the list. Its own permission
   * (`hr.employee.export`) because a bulk file with contact details is a
   * larger exposure than paging through records; its scope narrows the rows.
   */
  async exportCsv(query: QueryEmployeeDto): Promise<string> {
    const scope = await this.teamContext.resolveScope(EXPORT);
    const rows = await this.repository.findForExport(
      scope,
      toFilter(query),
      MAX_EXPORT_ROWS,
    );
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new BusinessRuleViolationException(
        `More than ${MAX_EXPORT_ROWS} employees match; narrow the filters`,
        "EXPORT_TOO_LARGE",
      );
    }
    return toCsv(
      EXPORT_HEADERS,
      rows.map((r) => toExportRow(toDetail(r))),
    );
  }

  /**
   * Bulk create from CSV — the same rules as creating one employee (`.own`
   * refused, `.team` only into the caller's teams), all rows in one
   * transaction: either every row is created or none is. `dryRun` validates
   * everything, including the database checks, and commits nothing.
   */
  async importCsv(
    file: { buffer: Buffer } | undefined,
    dryRun: boolean,
  ): Promise<EmployeeImportReport> {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not create employees");
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
        "The file needs a header row and at least one employee row",
      );
    }
    if (data.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `At most ${MAX_IMPORT_ROWS} employees per import (this file has ${data.length})`,
      );
    }
    const mapped = mapHeader(header);
    if (mapped.errors.length > 0) {
      throw new BadRequestException(mapped.errors);
    }

    const orgScope = this.tenantContext.getOrgScope();
    const parsed = parseImportRows(
      data,
      mapped.index,
      await this.repository.importLookups(orgScope),
    );
    if (scope.level === "team") {
      for (const { row, input } of parsed.rows) {
        if (!scope.teamIds.includes(input.teamId)) {
          parsed.errors.push({
            row,
            field: "team",
            message: "You may create employees only in your own team(s)",
          });
        }
      }
    }

    if (parsed.errors.length > 0) {
      const failedRows = new Set(parsed.errors.map((e) => e.row));
      return {
        dryRun,
        totalRows: data.length,
        validRows: data.length - failedRows.size,
        created: [],
        errors: parsed.errors.sort((a, b) => a.row - b.row),
      };
    }
    // Every row is valid on paper; the batch adds the database checks
    // (active references, reporting line) and commits only if all pass.
    const batch = await this.repository.createBatch(
      orgScope,
      parsed.rows,
      this.tenantContext.getUserId(),
      dryRun,
    );
    const failedRows = new Set(batch.errors.map((e) => e.row));
    return {
      dryRun,
      totalRows: data.length,
      validRows: data.length - failedRows.size,
      created: dryRun ? [] : batch.created,
      errors: batch.errors,
    };
  }

  approveOnboarding(id: number, note?: string) {
    return this.decide(id, "approve", note ?? null);
  }

  sendBackOnboarding(id: number, note: string) {
    return this.decide(id, "send_back", note);
  }

  /** `.own` is refused: nobody reviews their own profile (the repository also
   * refuses a reviewer whose login is the employee's). Out of scope → 404. */
  private async decide(
    id: number,
    decision: ReviewDecision,
    note: string | null,
  ) {
    const scope = await this.teamContext.resolveScope(APPROVE_ONBOARDING);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not review onboarding profiles");
    }
    const row = await this.repository.decideOnboarding(
      scope,
      id,
      decision,
      note,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  /** Visible to whoever may read the employee. The audit trail (with
   * before/after snapshots) is a separate, more restricted surface. */
  async statusHistory(id: number, pagination: PaginationDto) {
    const readScope = await this.teamContext.resolveScope(READ);
    if (!(await this.repository.findOne(readScope, id))) {
      throw new ResourceNotFoundException("Employee", id);
    }
    const { items, total } = await this.repository.findStatusHistory(
      this.tenantContext.getOrgScope(),
      id,
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }
}
