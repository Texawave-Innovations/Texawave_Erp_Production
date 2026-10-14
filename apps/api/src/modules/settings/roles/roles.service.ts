import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { AuditQueryService } from "../../../platform/audit/audit-query.service.js";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { AttachRolePermissionsDto } from "./dto/attach-role-permissions.dto.js";
import type { CloneRoleDto, CreateRoleDto } from "./dto/create-role.dto.js";
import type { QueryRoleDto } from "./dto/query-role.dto.js";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto.js";
import type { UpdateRoleDto } from "./dto/update-role.dto.js";
import { RolesRepository } from "./roles.repository.js";

/**
 * Roles and their grants (Docs/ARCHITECTURE.md §6; access-control rules in
 * §11, 2026-10-11). Beyond the `settings.role.*` permission checks:
 *  - optimistic locking: a write that carries `version` is refused with 409
 *    VERSION_CONFLICT when the role changed since it was read;
 *  - system roles keep their name and stay active (their grants are editable);
 *  - a role users still hold cannot be deactivated;
 *  - no change may leave nobody — or the caller — holding “Manage roles”;
 *  - every change is audited (`role`) and refreshes its users' permissions.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly permissions: PermissionsService,
    private readonly auditQuery: AuditQueryService,
  ) {}

  async findAll(query: QueryRoleDto) {
    const scope = this.tenantContext.getOrgScope();
    const pagination: PaginationDto = query;
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search },
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const role = await this.repository.findOneWithPermissions(scope, id);
    if (!role) {
      throw new ResourceNotFoundException("Role", id);
    }
    return role;
  }

  listPermissionCatalog() {
    return this.repository.findPermissionCatalog();
  }

  async create(dto: CreateRoleDto) {
    const scope = this.tenantContext.getOrgScope();
    await this.assertNameFree(scope, dto.name);
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async clone(id: number, dto: CloneRoleDto) {
    const scope = this.tenantContext.getOrgScope();
    await this.assertNameFree(scope, dto.name);
    const role = await this.repository.clone(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!role) throw new ResourceNotFoundException("Role", id);
    return this.findOne(role.id);
  }

  async update(id: number, dto: UpdateRoleDto) {
    const scope = this.tenantContext.getOrgScope();
    const { version, ...change } = dto;
    const ok = await this.repository.update(
      scope,
      id,
      change,
      version,
      this.tenantContext.getUserId(),
    );
    if (!ok) {
      throw new ResourceNotFoundException("Role", id);
    }
    if (dto.isActive !== undefined) {
      await this.invalidateUsersForRole(scope, id);
    }
    return this.findOne(id);
  }

  async setPermissions(id: number, dto: SetRolePermissionsDto) {
    const scope = this.tenantContext.getOrgScope();
    const ok = await this.repository.setPermissions(
      scope,
      id,
      dto.permissionIds,
      dto.version,
      this.tenantContext.getUserId(),
    );
    if (!ok) {
      throw new ResourceNotFoundException("Role", id);
    }
    await this.invalidateUsersForRole(scope, id);
    return this.findOne(id);
  }

  async attachPermissions(id: number, dto: AttachRolePermissionsDto) {
    const scope = this.tenantContext.getOrgScope();
    const idsFromCodes = await this.repository.resolvePermissionCodes([
      ...(dto.permissions ?? []),
      ...(dto.permissionCodes ?? []),
    ]);
    const allPermissionIds = [
      ...new Set([...(dto.permissionIds ?? []), ...idsFromCodes]),
    ];
    const ok = await this.repository.attachPermissions(
      scope,
      id,
      allPermissionIds,
      this.tenantContext.getUserId(),
    );
    if (!ok) {
      throw new ResourceNotFoundException("Role", id);
    }
    await this.invalidateUsersForRole(scope, id);
    return this.findOne(id);
  }

  /** The role's audit trail, newest first. Visibility follows the role:
   * whoever may read roles may read their history. */
  async history(id: number, pagination: PaginationDto) {
    await this.findOne(id);
    return this.auditQuery.history("role", id, pagination);
  }

  private async assertNameFree(scope: OrgScope, name: string) {
    const existing = await this.repository.findByName(scope, name);
    if (existing) {
      throw new ResourceConflictException(
        `A role named "${name}" already exists`,
      );
    }
  }

  private async invalidateUsersForRole(
    scope: OrgScope,
    roleId: number,
  ): Promise<void> {
    const userIds = await this.repository.findUserIdsForRole(scope, roleId);
    await Promise.all(
      userIds.map((userId) => this.permissions.invalidate(userId)),
    );
  }
}
