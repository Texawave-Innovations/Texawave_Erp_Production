import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { LocationMode } from "./dto/location-privilege.dto.js";

const PRIVILEGE_ENTITY = "employee_location_privilege";
const OFFICE_NETWORK_ENTITY = "office_network_address";

/** Every write is one transaction with its audit row (Docs/HR_API.md section 5). */
@Injectable()
export class LocationPrivilegeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Organization-wide: the employee must exist in the caller's organization. */
  @OrgScoped()
  findEmployeeInOrg(scope: OrgScope, employeeId: number) {
    return this.prisma.employee.findFirst({
      where: tenantWhere(scope, { id: employeeId, deletedAt: null }),
      select: { id: true, userId: true },
    });
  }

  /** The explicit row, or null when the employee was never classified. The
   * caller applies the OFFICE default. */
  @OrgScoped()
  findPrivilege(scope: OrgScope, employeeId: number) {
    return this.prisma.employeeLocationPrivilege.findFirst({
      where: tenantWhere(scope, { employeeId }),
      select: { mode: true, updatedAt: true, updatedBy: true },
    });
  }

  /** Sets the mode, writing the audit row only when the mode actually changes. */
  @OrgScoped()
  async setPrivilege(
    scope: OrgScope,
    employeeId: number,
    mode: LocationMode,
    userId: number,
  ): Promise<{ changed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.employeeLocationPrivilege.findFirst({
        where: tenantWhere(scope, { employeeId }),
        select: { id: true, mode: true },
      });
      if (existing?.mode === mode) return { changed: false };

      const row = existing
        ? await tx.employeeLocationPrivilege.update({
            where: { id: existing.id },
            data: { mode, updatedBy: userId },
            select: { id: true },
          })
        : await tx.employeeLocationPrivilege.create({
            data: {
              organizationId: scope.organizationId,
              employeeId,
              mode,
              createdBy: userId,
              updatedBy: userId,
            },
            select: { id: true },
          });
      await this.audit.write(tx, {
        entityType: PRIVILEGE_ENTITY,
        entityId: row.id,
        action: existing ? "update" : "create",
        before: { mode: existing?.mode ?? null },
        after: { mode, employeeId },
      });
      return { changed: true };
    });
  }

  @OrgScoped()
  listOfficeNetworks(scope: OrgScope, options: { activeOnly?: boolean } = {}) {
    return this.prisma.officeNetworkAddress.findMany({
      where: tenantWhere(scope, options.activeOnly ? { isActive: true } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        ipAddress: true,
        label: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  @OrgScoped()
  async addOfficeNetwork(
    scope: OrgScope,
    input: { ipAddress: string; label?: string | undefined },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const clash = await tx.officeNetworkAddress.findUnique({
        where: {
          organizationId_ipAddress: {
            organizationId: scope.organizationId,
            ipAddress: input.ipAddress,
          },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ResourceConflictException(
          `Office network address ${input.ipAddress} is already registered`,
        );
      }
      const row = await tx.officeNetworkAddress.create({
        data: {
          organizationId: scope.organizationId,
          ipAddress: input.ipAddress,
          label: input.label ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
        select: { id: true, ipAddress: true, label: true, isActive: true },
      });
      await this.audit.write(tx, {
        entityType: OFFICE_NETWORK_ENTITY,
        entityId: row.id,
        action: "create",
        after: { ipAddress: row.ipAddress, label: row.label, isActive: true },
      });
      return row;
    });
  }

  @OrgScoped()
  async setOfficeNetworkActive(
    scope: OrgScope,
    id: number,
    isActive: boolean,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.officeNetworkAddress.findFirst({
        where: tenantWhere(scope, { id }),
        select: { id: true, ipAddress: true, label: true, isActive: true },
      });
      if (!row) {
        throw new ResourceNotFoundException("Office network address", id);
      }
      if (row.isActive === isActive) return row;

      const updated = await tx.officeNetworkAddress.update({
        where: { id: row.id },
        data: { isActive, updatedBy: userId },
        select: { id: true, ipAddress: true, label: true, isActive: true },
      });
      await this.audit.write(tx, {
        entityType: OFFICE_NETWORK_ENTITY,
        entityId: row.id,
        action: "update",
        before: { isActive: row.isActive },
        after: { isActive },
      });
      return updated;
    });
  }
}
