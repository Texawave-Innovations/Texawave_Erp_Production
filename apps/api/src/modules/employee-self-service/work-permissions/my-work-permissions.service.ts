import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { NotificationsService } from "../../../platform/notifications/notifications.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../../hr/employees/employee-query.service.js";
import type {
  CreateWorkPermissionDto,
  DecideWorkPermissionDto,
  QueryAllWorkPermissionsDto,
  QueryMyWorkPermissionsDto,
} from "./dto/work-permission.dto.js";
import { MyWorkPermissionsRepository } from "./my-work-permissions.repository.js";

/** Work hours: 10:00–19:00 (10 AM – 7 PM). */
const WORK_START = "10:00";
const WORK_END = "19:00";
const MAX_DURATION_MINS = 120;

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

@Injectable()
export class MyWorkPermissionsService {
  constructor(
    private readonly repository: MyWorkPermissionsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employees: EmployeeQueryService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateWorkPermissionDto) {
    const fromMins = timeToMins(dto.fromTime);
    const toMins = timeToMins(dto.toTime);
    const workStartMins = timeToMins(WORK_START);
    const workEndMins = timeToMins(WORK_END);

    if (fromMins >= toMins) {
      throw new BusinessRuleViolationException(
        "fromTime must be before toTime",
        "INVALID_TIME_RANGE",
      );
    }

    if (fromMins < workStartMins) {
      throw new BusinessRuleViolationException(
        `Permission start time cannot be before work hours (${WORK_START})`,
        "BEFORE_WORK_HOURS",
      );
    }

    if (toMins > workEndMins) {
      throw new BusinessRuleViolationException(
        `Permission end time cannot be after work hours (${WORK_END})`,
        "AFTER_WORK_HOURS",
      );
    }

    const durationMins = toMins - fromMins;
    if (durationMins > MAX_DURATION_MINS) {
      throw new BusinessRuleViolationException(
        `Permission duration cannot exceed ${MAX_DURATION_MINS} minutes (2 hours)`,
        "EXCEEDS_MAX_DURATION",
      );
    }

    const employee = await this.employees.getCurrentEmployee();
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const created = await this.repository.create(scope, {
      employeeId: employee.id,
      date: dto.date,
      fromTime: dto.fromTime,
      toTime: dto.toTime,
      durationMins,
      reason: dto.reason,
      requestedBy: userId,
    });

    void this.notifications.notifyAdmins(
      scope,
      {
        type: "work_permission.submitted",
        title: "New Permission Request",
        body: `${employee.fullName} requested permission on ${dto.date} from ${dto.fromTime} to ${dto.toTime} (${durationMins} min). Reason: ${dto.reason}`,
        link: `/hr/leaves?tab=permissions`,
      },
      userId,
    );

    return created;
  }

  async findMine(query: QueryMyWorkPermissionsDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
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
    if (!row) throw new ResourceNotFoundException("Work permission", id);
    return row;
  }

  async findAll(query: QueryAllWorkPermissionsDto) {
    const { items, total } = await this.repository.findAll(
      this.tenantContext.getOrgScope(),
      {
        status: query.status,
        year: query.year,
        skip: query.skip,
        limit: query.limit,
      },
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async decide(id: number, dto: DecideWorkPermissionDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    if (!["APPROVED", "REJECTED"].includes(dto.decision)) {
      throw new BusinessRuleViolationException(
        "decision must be APPROVED or REJECTED",
        "INVALID_DECISION",
      );
    }
    if (dto.decision === "REJECTED" && !dto.hrNote?.trim()) {
      throw new BusinessRuleViolationException(
        "A note is required when rejecting a permission request",
        "NOTE_REQUIRED",
      );
    }

    const existing = await this.repository.findOne(scope, id);
    if (!existing) throw new ResourceNotFoundException("Work permission", id);
    if (existing.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        "Only PENDING requests can be decided",
        "ALREADY_DECIDED",
      );
    }

    const updated = await this.repository.decide(scope, id, {
      status: dto.decision,
      hrNote: dto.hrNote,
      decidedBy: userId,
    });

    void this.notifications.notifyUser(scope, existing.requestedBy, {
      type: "work_permission.decided",
      title: `Permission Request ${dto.decision === "APPROVED" ? "Approved" : "Rejected"}`,
      body: `Your permission request on ${existing.date.toISOString().slice(0, 10)} from ${existing.fromTime} to ${existing.toTime} was ${dto.decision.toLowerCase()}.${dto.hrNote ? ` Note: ${dto.hrNote}` : ""}`,
      link: `/portal/permissions`,
    });

    return updated;
  }
}
