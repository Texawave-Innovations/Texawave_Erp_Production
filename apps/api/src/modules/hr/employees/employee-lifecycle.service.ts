import { Injectable, Logger } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { AuthService } from "../../../platform/auth/auth.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  ChangeEmployeeStatusDto,
  CorrectEmployeeStatusDto,
  LinkEmployeeUserDto,
  UnlinkEmployeeUserDto,
} from "./dto/lifecycle.dto.js";
import { EmployeeLifecycleRepository } from "./employee-lifecycle.repository.js";
import { toDetail } from "./employee-mappers.js";

@Injectable()
export class EmployeeLifecycleService {
  private readonly logger = new Logger(EmployeeLifecycleService.name);

  constructor(
    private readonly repository: EmployeeLifecycleRepository,
    private readonly tenantContext: TenantContextService,
    private readonly auth: AuthService,
  ) {}

  changeStatus(id: number, dto: ChangeEmployeeStatusDto) {
    return this.applyStatus(id, dto, false);
  }

  /** The only way out of RESIGNED/TERMINATED. Guarded by its own permission. */
  correctStatus(id: number, dto: CorrectEmployeeStatusDto) {
    return this.applyStatus(id, dto, true);
  }

  async linkUser(id: number, dto: LinkEmployeeUserDto) {
    const row = await this.repository.linkUser(
      this.tenantContext.getOrgScope(),
      id,
      dto.userId,
      dto.reason,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  async unlinkUser(id: number, dto: UnlinkEmployeeUserDto) {
    const row = await this.repository.unlinkUser(
      this.tenantContext.getOrgScope(),
      id,
      dto.reason,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  private async applyStatus(
    id: number,
    dto: ChangeEmployeeStatusDto,
    correction: boolean,
  ) {
    const result = await this.repository.changeStatus(
      this.tenantContext.getOrgScope(),
      id,
      {
        to: dto.status,
        effectiveDate: dto.effectiveDate,
        reason: dto.reason,
        correction,
      },
      this.tenantContext.getUserId(),
    );
    if (!result) throw new ResourceNotFoundException("Employee", id);

    // The login is already disabled inside the transaction, so a new sign-in
    // is impossible. Revoking existing refresh tokens and cached permissions
    // is outside the database and can fail independently: the status change
    // has committed and must not be reported as failed, but the failure must
    // not be silent either.
    for (const userId of [result.disabledUserId, result.enabledUserId]) {
      if (userId === null) continue;
      try {
        await this.auth.logout(userId);
      } catch (error) {
        this.logger.error(
          `Employee ${id}: status committed but revoking sessions for user ${userId} failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return toDetail(result.employee);
  }
}
