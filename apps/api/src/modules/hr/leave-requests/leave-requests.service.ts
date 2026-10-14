import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import type {
  ApproveLeaveRequestDto,
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  HrCancelLeaveRequestDto,
  HrCreateLeaveRequestDto,
  HrLeaveBalanceQueryDto,
  LeaveBalanceQueryDto,
  QueryAwaitingLeaveDto,
  QueryLeaveRequestDto,
  QueryMyLeaveRequestDto,
  RejectLeaveRequestDto,
  SetLeaveEntitlementDto,
} from "./dto/leave-request.dto.js";
import { LeaveNotificationsService } from "./leave-notifications.service.js";
import {
  LeaveOwnViaSelfServiceException,
  LeaveRequestsRepository,
  today,
} from "./leave-requests.repository.js";

export const READ = "hr.leave_request.read";
export const APPROVE = "hr.leave.approve";
export const CREATE = "hr.leave_request.create";
export const CANCEL = "hr.leave.cancel";

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly repository: LeaveRequestsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
    private readonly notifier: LeaveNotificationsService,
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

  /**
   * Any `hr.leave.approve` level may decide as the employee's reporting
   * manager (or that manager's delegate); `.team`/`.all` also decide within
   * their scope, and only `.all` gives the second (HR) approval. A request
   * the caller has no authority over is 404 — except that an `.own`-only
   * caller gets 403, as before (`.own` grants nothing beyond the reporting
   * line, so there is nothing to hide).
   */
  private async decide(
    id: number,
    status: "APPROVED" | "REJECTED",
    note: string | undefined,
  ) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const outcome = await this.repository.decide(
      scope,
      id,
      { status, note },
      this.tenantContext.getUserId(),
      today(),
    );
    if (outcome.kind === "not_found") {
      if (scope.level === "own") {
        throw new ForbiddenException(
          "You may approve or reject only the leave of people who report to you",
        );
      }
      throw new ResourceNotFoundException("Leave request", id);
    }
    await this.notifier.leaveChanged(id, {
      kind:
        status === "REJECTED"
          ? "rejected"
          : outcome.final
            ? "approved"
            : "first_approved",
    });
    return outcome.view;
  }

  /** PENDING requests waiting for the caller (reporting line, delegation,
   * scope, and HR's second approval). */
  async findAwaiting(query: QueryAwaitingLeaveDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const { items, total } = await this.repository.findAwaiting(
      scope,
      this.tenantContext.getUserId(),
      today(),
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** HR applies for leave on an employee's behalf. `.own` grants nothing
   * (one's own leave is self-service); the employee must be in the caller's
   * scope (else 404) and not the caller's own record. Same validation as
   * self-service (balance, overlap, working days). */
  async createOnBehalf(dto: HrCreateLeaveRequestDto) {
    const scope = await this.teamContext.resolveScope(CREATE);
    if (scope.level === "own") {
      throw new ForbiddenException(
        "You may not apply for leave on someone else's behalf",
      );
    }
    const visible = await this.repository.employeeVisible(
      scope,
      dto.employeeId,
    );
    if (!visible) {
      throw new ResourceNotFoundException("Employee", dto.employeeId);
    }
    const me = await this.employees.findCurrentEmployeeOrNull();
    if (me?.id === dto.employeeId) throw new LeaveOwnViaSelfServiceException();
    const view = await this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
      "submit_on_behalf",
    );
    await this.notifier.leaveChanged(view.id, {
      kind: "submitted",
      onBehalf: true,
      resubmitted: false,
    });
    return view;
  }

  /** HR cancels a pending or approved leave of someone in scope (an approved
   * one even after it started), with a mandatory reason. */
  async hrCancel(id: number, dto: HrCancelLeaveRequestDto) {
    const scope = await this.teamContext.resolveScope(CANCEL);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not cancel other people's leave");
    }
    const result = await this.repository.hrCancel(
      scope,
      id,
      dto.note,
      this.tenantContext.getUserId(),
    );
    if (!result) throw new ResourceNotFoundException("Leave request", id);
    await this.notifier.leaveChanged(id, {
      kind: "cancelled",
      byHr: true,
      wasApproved: result.previous === "APPROVED",
    });
    return result.view;
  }

  /** Balances of one employee, within the caller's scope (else 404). */
  async hrBalances(query: HrLeaveBalanceQueryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const visible = await this.repository.employeeVisible(
      scope,
      query.employeeId,
    );
    if (!visible) {
      throw new ResourceNotFoundException("Employee", query.employeeId);
    }
    return this.balanceSheet(
      query.employeeId,
      query.year ?? Number(today().slice(0, 4)),
    );
  }

  /** Sets or clears one employee's annual entitlement override. Org-wide
   * administration, gated by `hr.leave_type.write` at the controller. */
  async setEntitlement(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    dto: SetLeaveEntitlementDto,
  ) {
    return this.repository.setEntitlement(
      this.tenantContext.getOrgScope(),
      {
        employeeId,
        leaveTypeId,
        year,
        annualEntitlement: dto.annualEntitlement,
      },
      this.tenantContext.getUserId(),
    );
  }

  // ---- self-service (the authenticated user's own employee record) ---------

  /** Submits leave for the AUTHENTICATED user's employee. The employee is
   * resolved from the JWT via the employee↔user mapping; the client cannot
   * name one (403 NOT_AN_EMPLOYEE if the login is not linked). */
  async createForCurrentEmployee(dto: CreateLeaveRequestDto) {
    const employee = await this.employees.getCurrentEmployee();
    const view = await this.repository.create(
      this.tenantContext.getOrgScope(),
      { ...dto, employeeId: employee.id },
      this.tenantContext.getUserId(),
    );
    await this.notifier.leaveChanged(view.id, {
      kind: "submitted",
      onBehalf: false,
      resubmitted: false,
    });
    return view;
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

  async findMineOne(id: number) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.findMineOne(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
    );
    if (!row) throw new ResourceNotFoundException("Leave request", id);
    return row;
  }

  async cancelMine(id: number, dto: CancelLeaveRequestDto) {
    const employee = await this.employees.getCurrentEmployee();
    const wasApproved =
      (
        await this.repository.findMineOne(
          this.tenantContext.getOrgScope(),
          employee.id,
          id,
        )
      )?.status === "APPROVED";
    const row = await this.repository.cancel(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      dto.note,
      this.tenantContext.getUserId(),
      today(),
    );
    if (!row) throw new ResourceNotFoundException("Leave request", id);
    await this.notifier.leaveChanged(id, {
      kind: "cancelled",
      byHr: false,
      wasApproved,
    });
    return row;
  }

  async resubmitMine(id: number) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.resubmit(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      this.tenantContext.getUserId(),
      today(),
    );
    if (!row) throw new ResourceNotFoundException("Leave request", id);
    await this.notifier.leaveChanged(id, {
      kind: "submitted",
      onBehalf: false,
      resubmitted: true,
    });
    return row;
  }

  async myBalances(query: LeaveBalanceQueryDto) {
    const employee = await this.employees.getCurrentEmployee();
    return this.balanceSheet(
      employee.id,
      query.year ?? Number(today().slice(0, 4)),
    );
  }

  private async balanceSheet(employeeId: number, year: number) {
    const rows = await this.repository.balanceSheet(
      this.tenantContext.getOrgScope(),
      employeeId,
      year,
      today(),
    );
    if (!rows) throw new ResourceNotFoundException("Employee", employeeId);
    return rows;
  }
}
