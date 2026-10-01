import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import type {
  ApproveLeaveRequestDto,
  CreateLeaveRequestDto,
  QueryLeaveRequestDto,
  QueryMyLeaveRequestDto,
  RejectLeaveRequestDto,
} from "./dto/leave-request.dto.js";
import { LeaveRequestsRepository } from "./leave-requests.repository.js";

const READ = "hr.leave_request.read";
const APPROVE = "hr.leave.approve";

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly repository: LeaveRequestsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
  ) {}

  // ---- HR / approver view (own · team · all) -------------------------------

  async findAll(query: QueryLeaveRequestDto) {
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
    if (!row) throw new ResourceNotFoundException("Leave request", id);
    return row;
  }

  approve(id: number, dto: ApproveLeaveRequestDto) {
    return this.decide(id, "APPROVED", dto.note);
  }

  reject(id: number, dto: RejectLeaveRequestDto) {
    return this.decide(id, "REJECTED", dto.note);
  }

  private async decide(
    id: number,
    status: "APPROVED" | "REJECTED",
    note: string | undefined,
  ) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    if (scope.level === "own") {
      // `.own` exists only so the permission family is complete: nobody may
      // decide their own request, so it grants no approval at all.
      throw new ForbiddenException(
        "You may not approve or reject leave requests",
      );
    }
    const row = await this.repository.decide(
      scope,
      id,
      { status, note },
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Leave request", id);
    return row;
  }

  // ---- self-service (the authenticated user's own employee record) ---------

  /** Submits leave for the AUTHENTICATED user's employee. The employee is
   * resolved from the JWT via the employee↔user mapping; the client cannot
   * name one (403 NOT_AN_EMPLOYEE if the login is not linked). */
  async createForCurrentEmployee(dto: CreateLeaveRequestDto) {
    const employee = await this.employees.getCurrentEmployee();
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      { ...dto, employeeId: employee.id },
      this.tenantContext.getUserId(),
    );
  }

  async findMine(query: QueryMyLeaveRequestDto) {
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
