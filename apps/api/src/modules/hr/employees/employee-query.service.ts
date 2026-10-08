import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { NotAnEmployeeException } from "./employee.exceptions.js";
import { toDetail, type EmployeeDetail } from "./employee-mappers.js";
import { EmployeesRepository } from "./employees.repository.js";

/**
 * Public, exported read surface of the employees module for OTHER modules
 * (self-service, leave, shifts, later attendance). Other modules never import
 * `EmployeesRepository` (module-boundary rule); they call this.
 */
@Injectable()
export class EmployeeQueryService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** The employee linked to the AUTHENTICATED user — resolved from the JWT's
   * user id, never from anything the client sends. */
  async getCurrentEmployee(): Promise<EmployeeDetail> {
    const row = await this.repository.findByUserId(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
    );
    if (!row) throw new NotAnEmployeeException();
    return toDetail(row);
  }

  /** Same lookup as `getCurrentEmployee()`, but for callers where "not an
   * employee" is a valid state rather than an error — an admin/HR-manager
   * account holding a team/all-scope decide permission (e.g.
   * `hr.work_log.approve`) is never itself an employee, so a hard 403 there
   * would misreport an authorization failure the permission guard already
   * cleared. Returns `null` instead of throwing. */
  async findCurrentEmployeeOrNull(): Promise<EmployeeDetail | null> {
    const row = await this.repository.findByUserId(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
    );
    return row ? toDetail(row) : null;
  }

  /** Called by employee-self-service once every required onboarding section
   * is filled in. No-op if the employee isn't currently PENDING_PROFILE
   * (already complete, or hasn't changed their temp password yet) — the
   * caller (ProfileService) checks completeness before calling this. */
  async completeOnboarding(): Promise<void> {
    const employee = await this.getCurrentEmployee();
    await this.repository.markOnboardingComplete(
      this.tenantContext.getOrgScope(),
      employee.id,
    );
  }
}
