import { ForbiddenException, Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateOfficeNetworkDto,
  LocationMode,
  SetLocationPrivilegeDto,
} from "./dto/location-privilege.dto.js";
import { LocationNotAllowedException } from "./location-privilege.exceptions.js";
import { LocationPrivilegeRepository } from "./location-privilege.repository.js";
import { isOnOfficeNetwork, normalizeIp } from "./office-network.js";

export const READ = "hr.location_privilege.read";
export const WRITE = "hr.location_privilege.write";

/** Location Privilege (Docs/HR_LEGACY_PARITY.md section 12). It decides only
 * whether an attendance punch needs the office network. Portal access is not
 * gated here. Permissions are organization-wide: legacy has no team dimension. */
@Injectable()
export class LocationPrivilegeService {
  constructor(
    private readonly repository: LocationPrivilegeRepository,
    private readonly tenantContext: TenantContextService,
    private readonly cls: ClsService,
  ) {}

  async getEmployeePrivilege(employeeId: number) {
    const orgScope = this.tenantContext.getOrgScope();
    await this.assertEmployeeInOrg(employeeId);
    const row = await this.repository.findPrivilege(orgScope, employeeId);
    return {
      employeeId,
      // null means never set: no network restriction applies to the punch.
      mode: (row?.mode as LocationMode | undefined) ?? null,
      source: row ? "explicit" : "unset",
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async setEmployeePrivilege(employeeId: number, dto: SetLocationPrivilegeDto) {
    // Nobody changes their own location privilege, whatever permissions they hold.
    const employee = await this.assertEmployeeInOrg(employeeId);
    if (
      employee.userId !== null &&
      employee.userId === this.tenantContext.getUserId()
    ) {
      throw new ForbiddenException(
        "You may not change your own location privilege",
      );
    }
    const result = await this.repository.setPrivilege(
      this.tenantContext.getOrgScope(),
      employeeId,
      dto.mode,
      this.tenantContext.getUserId(),
    );
    return { employeeId, mode: dto.mode, changed: result.changed };
  }

  listOfficeNetworks() {
    return this.repository.listOfficeNetworks(this.tenantContext.getOrgScope());
  }

  addOfficeNetwork(dto: CreateOfficeNetworkDto) {
    return this.repository.addOfficeNetwork(
      this.tenantContext.getOrgScope(),
      { ipAddress: normalizeIp(dto.ipAddress), label: dto.label },
      this.tenantContext.getUserId(),
    );
  }

  setOfficeNetworkActive(id: number, isActive: boolean) {
    return this.repository.setOfficeNetworkActive(
      this.tenantContext.getOrgScope(),
      id,
      isActive,
      this.tenantContext.getUserId(),
    );
  }

  /** Called by the attendance check-in and check-out paths before any write.
   * Opt-in: only an explicit OFFICE row is gated. An employee with no row, or
   * with REMOTE, punches as before. An OFFICE punch needs the request's client
   * address on the active office list. The address comes from the request
   * context the tenancy interceptor fills, the same source the audit trail
   * uses. An OFFICE employee is denied when the address is missing or the
   * list is empty. */
  async assertPunchAllowed(employeeId: number): Promise<void> {
    const orgScope = this.tenantContext.getOrgScope();
    const row = await this.repository.findPrivilege(orgScope, employeeId);
    if (row?.mode !== "OFFICE") return;

    const clientIp = this.cls.get<string | undefined>("ip");
    const officeIps = (
      await this.repository.listOfficeNetworks(orgScope, { activeOnly: true })
    ).map((network) => network.ipAddress);
    if (!isOnOfficeNetwork(clientIp, officeIps)) {
      throw new LocationNotAllowedException();
    }
  }

  private async assertEmployeeInOrg(employeeId: number) {
    const employee = await this.repository.findEmployeeInOrg(
      this.tenantContext.getOrgScope(),
      employeeId,
    );
    if (!employee) throw new ResourceNotFoundException("Employee", employeeId);
    return employee;
  }
}
