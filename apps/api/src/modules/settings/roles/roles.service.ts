import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateRoleDto } from "./dto/create-role.dto.js";
import type { QueryRoleDto } from "./dto/query-role.dto.js";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto.js";
import type { UpdateRoleDto } from "./dto/update-role.dto.js";
import { RolesRepository } from "./roles.repository.js";

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly permissions: PermissionsService,
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
    const existing = await this.repository.findByName(scope, dto.name);
    if (existing) {
      throw new ResourceConflictException(
        `A role named "${dto.name}" already exists`,
      );
    }
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateRoleDto) {
    const scope = this.tenantContext.getOrgScope();
    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Role", id);
    }
    if (dto.isActive === false) {
      await this.invalidateUsersForRole(scope, id);
    }
    return updated;
  }

  async setPermissions(id: number, dto: SetRolePermissionsDto) {
    const scope = this.tenantContext.getOrgScope();
    const updatedBy = this.tenantContext.getUserId();
    const ok = await this.repository.setPermissions(
      scope,
      id,
      dto.permissionIds,
      updatedBy,
    );
    if (!ok) {
      throw new ResourceNotFoundException("Role", id);
    }
    await this.invalidateUsersForRole(scope, id);
    return this.repository.findOneWithPermissions(scope, id);
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
