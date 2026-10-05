import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import type {
  CreateWorkLogDto,
  DecideWorkLogDto,
  QueryMyWorkLogDto,
  QueryWorkLogApprovalsDto,
  QueryWorkLogDto,
} from "./dto/work-log.dto.js";
import { WorkLogsRepository } from "./work-logs.repository.js";

const READ = "hr.work_log.read";

@Injectable()
export class WorkLogsService {
  constructor(
    private readonly repository: WorkLogsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
  ) {}

  // ---- HR view (own · team · all) ------------------------------------------

  async findAll(query: QueryWorkLogDto) {
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
    if (!row) throw new ResourceNotFoundException("Work log", id);
    return row;
  }

  // ---- approver view (the caller's direct reports) --------------------------

  /** Defaults to PENDING: the approver's queue is what still needs a decision. */
  async findApprovals(query: QueryWorkLogApprovalsDto) {
    const approver = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findDirectReports(
      this.tenantContext.getOrgScope(),
      approver.id,
      { ...query, status: query.status ?? "PENDING" },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async approve(id: number, dto: DecideWorkLogDto) {
    return this.decide(id, "APPROVED", dto.note);
  }

  async reject(id: number, dto: DecideWorkLogDto) {
    return this.decide(id, "REJECTED", dto.note);
  }

  private async decide(
    id: number,
    status: "APPROVED" | "REJECTED",
    note: string | undefined,
  ) {
    const approver = await this.employees.getCurrentEmployee();
    const row = await this.repository.decide(
      this.tenantContext.getOrgScope(),
      id,
      approver.id,
      { status, note },
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Work log", id);
    return row;
  }

  // ---- self-service (the authenticated user's own employee record) ----------

  /** Submits a log for the AUTHENTICATED user's employee. The employee is
   * resolved from the JWT; the client cannot name one. */
  async createForCurrentEmployee(dto: CreateWorkLogDto) {
    const employee = await this.employees.getCurrentEmployee();
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      { ...dto, employeeId: employee.id },
      this.tenantContext.getUserId(),
    );
  }

  async findMine(query: QueryMyWorkLogDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }
}
