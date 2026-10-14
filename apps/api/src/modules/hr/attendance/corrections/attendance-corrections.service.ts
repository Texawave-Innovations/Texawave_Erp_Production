import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import { AttendanceSelfApprovalForbiddenException } from "../attendance.exceptions.js";
import { istDateOf } from "../services/attendance-calculation.service.js";
import { ALLOWED_TIMES } from "../services/attendance-correction-planner.js";
import type {
  ApproveAttendanceCorrectionDto,
  QueryAttendanceCorrectionDto,
  RejectAttendanceCorrectionDto,
  SubmitAttendanceCorrectionDto,
} from "../dto/attendance-correction.dto.js";
import { AttendanceCorrectionsRepository } from "./attendance-corrections.repository.js";

export const CORRECTION_READ = "hr.attendance_correction.read";
export const CORRECTION_APPROVE = "hr.attendance_correction.approve";

@Injectable()
export class AttendanceCorrectionsService {
  constructor(
    private readonly repository: AttendanceCorrectionsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
  ) {}

  /** Submits a correction for the AUTHENTICATED user's own employee record.
   * The request is checked for shape and date here; whether the punches can
   * actually be changed is decided at approval, against the day as it is then. */
  async submitForCurrentEmployee(dto: SubmitAttendanceCorrectionDto) {
    validateSubmission(dto);
    const employee = await this.employees.getCurrentEmployee();
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      { ...dto, employeeId: employee.id },
      this.tenantContext.getUserId(),
    );
  }

  async findAll(query: QueryAttendanceCorrectionDto) {
    const scope = await this.teamContext.resolveScope(CORRECTION_READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(CORRECTION_READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Attendance correction", id);
    return row;
  }

  approve(id: number, dto: ApproveAttendanceCorrectionDto) {
    return this.decide(id, "APPROVED", dto.note);
  }

  reject(id: number, dto: RejectAttendanceCorrectionDto) {
    return this.decide(id, "REJECTED", dto.note);
  }

  private async decide(
    id: number,
    status: "APPROVED" | "REJECTED",
    note: string | undefined,
  ) {
    const scope = await this.teamContext.resolveScope(CORRECTION_APPROVE);
    if (scope.level === "own") {
      // `.own` exists only so the permission family is complete: nobody may
      // decide a request about themselves, so it grants no decision at all.
      throw new ForbiddenException(
        "You may not approve or reject attendance corrections",
      );
    }
    const current = await this.repository.findOne(scope, id);
    if (!current)
      throw new ResourceNotFoundException("Attendance correction", id);

    const userId = this.tenantContext.getUserId();
    if (current.requestedBy === userId || current.employee.userId === userId) {
      throw new AttendanceSelfApprovalForbiddenException();
    }

    return this.repository.decide(this.tenantContext.getOrgScope(), id, {
      status,
      decidedBy: userId,
      note,
    });
  }
}

/** Shape and date rules that do not depend on the day's current punches. */
export function validateSubmission(dto: SubmitAttendanceCorrectionDto): void {
  const allowed = ALLOWED_TIMES[dto.correctionType];
  if (!allowed) {
    throw new BusinessRuleViolationException(
      "Unknown correction type",
      "INVALID_CORRECTION_TYPE",
    );
  }
  const hasIn = dto.requestedCheckInAt !== undefined;
  const hasOut = dto.requestedCheckOutAt !== undefined;
  if (!hasIn && !hasOut) {
    throw new BusinessRuleViolationException(
      "A correction must request a time",
      "CORRECTION_TIME_REQUIRED",
    );
  }
  if ((hasIn && !allowed.in) || (hasOut && !allowed.out)) {
    throw new BusinessRuleViolationException(
      `${dto.correctionType} does not change that punch`,
      "CORRECTION_FIELD_NOT_ALLOWED",
    );
  }
  if (dto.correctionType === "MISSED_CHECK_IN" && !hasIn) {
    throw new BusinessRuleViolationException(
      "A missed check-in needs the check-in time",
      "CORRECTION_TIME_REQUIRED",
    );
  }
  if (dto.correctionType === "MISSED_CHECK_OUT" && !hasOut) {
    throw new BusinessRuleViolationException(
      "A missed check-out needs the check-out time",
      "CORRECTION_TIME_REQUIRED",
    );
  }
  if (dto.correctionType === "LATE_ARRIVAL" && !hasIn) {
    throw new BusinessRuleViolationException(
      "A late arrival needs the corrected check-in",
      "CORRECTION_TIME_REQUIRED",
    );
  }
  if (dto.correctionType === "EARLY_DEPARTURE" && !hasOut) {
    throw new BusinessRuleViolationException(
      "An early departure needs the corrected check-out",
      "CORRECTION_TIME_REQUIRED",
    );
  }

  const today = istDateOf(new Date());
  if (dto.attendanceDate > today) {
    throw new BusinessRuleViolationException(
      "A correction cannot be requested for a future date",
      "FUTURE_DATE",
    );
  }
  for (const value of [dto.requestedCheckInAt, dto.requestedCheckOutAt]) {
    if (value === undefined) continue;
    const instant = new Date(value);
    if (istDateOf(instant) !== dto.attendanceDate) {
      throw new BusinessRuleViolationException(
        "A requested time must fall on the attendance date (IST)",
        "PUNCH_OUTSIDE_DATE",
      );
    }
  }
  if (
    hasIn &&
    hasOut &&
    new Date(dto.requestedCheckOutAt!) <= new Date(dto.requestedCheckInAt!)
  ) {
    throw new BusinessRuleViolationException(
      "The requested check-out must be after the check-in",
      "CHECK_OUT_BEFORE_CHECK_IN",
    );
  }
}
