import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  ShiftAssignmentsRepository,
  type ResolvedShift,
} from "./shift-assignments.repository.js";

/**
 * Public, exported surface for OTHER modules (Attendance will be the
 * consumer). It answers "which shift does this employee work on this date?"
 * within the caller's organization. It performs NO own/team/all check — it is
 * for trusted server-side callers that have already authorized the request;
 * never expose it directly on a route.
 *
 * Precedence and its limits are documented on
 * `ShiftAssignmentsRepository.resolve` (unapproved default — confirm before
 * Attendance depends on it).
 */
@Injectable()
export class ShiftQueryService {
  constructor(
    private readonly repository: ShiftAssignmentsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** `date` must be a date-only value (UTC midnight), see `parseDateOnly`. */
  shiftFor(employeeId: number, date: Date): Promise<ResolvedShift | null> {
    return this.repository.resolve(
      this.tenantContext.getOrgScope(),
      employeeId,
      date,
    );
  }
}
