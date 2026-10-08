import { HttpStatus, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import type {
  CreateExitRequestDto,
  QueryExitRequestDto,
  QueryMyExitRequestDto,
  UpdateExitRequestDto,
} from "./dto/exit-request.dto.js";
import { ExitRequestsRepository } from "./exit-requests.repository.js";

const READ = "hr.exit_request.read";
const DECIDE = "hr.exit_request.decide";
/** Legacy notice period default (ExitRequest.tsx `noticeDays` = '30'). */
const DEFAULT_NOTICE_DAYS = 30;

/** Reviewing or deciding needs team or all-team reach. An own-level holder gets
 * a 403 here, before any row is read. */
export class ExitRequestDecisionScopeException extends BusinessException {
  constructor() {
    super(
      "Reviewing an exit request requires team or all-team scope",
      HttpStatus.FORBIDDEN,
      "DECISION_SCOPE_REQUIRED",
    );
  }
}

@Injectable()
export class ExitRequestsService {
  constructor(
    private readonly repository: ExitRequestsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
  ) {}

  // ---- HR view (own · team · all) ------------------------------------------

  async findAll(query: QueryExitRequestDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Exit request", id);
    return row;
  }

  // ---- review and decision (team · all) ------------------------------------

  /** Moves a request along the transition map and/or edits HR's fields. The
   * reviewer's employee record is resolved from the JWT, so self-decision can be
   * detected. */
  async update(id: number, dto: UpdateExitRequestDto) {
    if (
      dto.status === undefined &&
      dto.confirmedLastWorkingDate === undefined &&
      dto.settlementStatus === undefined &&
      dto.hrNote === undefined
    ) {
      throw new BusinessRuleViolationException(
        "Send at least one field to change",
        "NO_CHANGES",
      );
    }
    const scope = await this.teamContext.resolveScope(DECIDE);
    if (scope.level === "own") throw new ExitRequestDecisionScopeException();
    // `reviewer` is only used to detect self-decision below; an admin
    // account holding team/all-scope decide without being linked to an
    // employee can never be deciding their own request (they have no
    // employee row at all), so `null` here is a valid state, not an error.
    const reviewer = await this.employees.findCurrentEmployeeOrNull();
    const row = await this.repository.update(
      scope,
      id,
      reviewer?.id ?? null,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Exit request", id);
    return row;
  }

  // ---- self-service (the authenticated user's own employee record) ---------

  /** Submits a request for the AUTHENTICATED user's employee. The client cannot
   * name an employee. The preferred last working day cannot be in the past
   * (legacy date input has min = today). */
  async createForCurrentEmployee(dto: CreateExitRequestDto) {
    if (dto.preferredLastWorkingDate < new Date().toISOString().slice(0, 10)) {
      throw new BusinessRuleViolationException(
        "Preferred last working day cannot be in the past",
        "PAST_LAST_WORKING_DATE",
      );
    }
    const employee = await this.employees.getCurrentEmployee();
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        employeeId: employee.id,
        reason: dto.reason,
        preferredLastWorkingDate: dto.preferredLastWorkingDate,
        noticePeriodDays: dto.noticePeriodDays ?? DEFAULT_NOTICE_DAYS,
        additionalNotes: dto.additionalNotes,
      },
      this.tenantContext.getUserId(),
    );
  }

  async findMine(query: QueryMyExitRequestDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 for another employee's request, never 403. */
  async findMineOne(id: number) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.findMineOne(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
    );
    if (!row) throw new ResourceNotFoundException("Exit request", id);
    return row;
  }
}
