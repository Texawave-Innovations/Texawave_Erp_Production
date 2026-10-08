import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { PermissionsService } from "../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { TEAM_ACCESS_LEVELS } from "../../common/tenancy/team-scope.js";
import type { CreateMenuItemDto } from "./dto/create-menu-item.dto.js";
import type { QueryMenuItemDto } from "./dto/query-menu-item.dto.js";
import type { UpdateMenuItemDto } from "./dto/update-menu-item.dto.js";
import { MenuRepository } from "./menu.repository.js";

export interface MenuTreeNode {
  id: number;
  code: string;
  label: string;
  path: string | null;
  icon: string | null;
  order: number;
  parentId: number | null;
  permission: string | null;
  children: MenuTreeNode[];
}

@Injectable()
export class MenuService {
  constructor(
    private readonly repository: MenuRepository,
    private readonly tenantContext: TenantContextService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Resolves the navigation menu for the current user, filtered server-side
   * against the user's cached permission set. If a menu item defines a
   * required permission, it is only included if the user holds that permission.
   */
  async getMyMenu(userId: number): Promise<MenuTreeNode[]> {
    if (!userId || typeof userId !== "number") {
      return [];
    }
    const scope = this.tenantContext.getOrgScope();
    const userPermissions =
      await this.permissions.getPermissionsForUser(userId);
    const permissionSet = new Set(userPermissions);

    const allItems = await this.repository.findActiveItems(scope);

    // 1. Filter items allowed for this user
    //
    // A menu item's `permission` is either an exact, unscoped permission
    // code (e.g. "departments.department.read") or the prefix of a scoped
    // permission family defined via `scopedPermission()`
    // (packages/database/prisma/permissions/catalog.ts), which only ever
    // grants `<prefix>.own`/`.team`/`.all` — never the bare prefix itself.
    // Mirror PermissionsGuard's exact-or-scoped check
    // (apps/api/src/platform/roles-permissions/permissions.guard.ts) so a
    // menu item wired to a scoped-only permission (e.g.
    // "hr.attendance_report.read") is still shown to anyone holding any of
    // its scoped variants.
    const allowedItems = allItems.filter((item) => {
      if (!item.permission) {
        return true;
      }
      if (permissionSet.has(item.permission)) {
        return true;
      }
      return TEAM_ACCESS_LEVELS.some((level) =>
        permissionSet.has(`${item.permission}.${level}`),
      );
    });

    // 2. Build tree structure
    const itemMap = new Map<number, MenuTreeNode>();
    for (const item of allowedItems) {
      itemMap.set(item.id, {
        id: item.id,
        code: item.code,
        label: item.label,
        path: item.path,
        icon: item.icon,
        order: item.order,
        parentId: item.parentId,
        permission: item.permission,
        children: [],
      });
    }

    const roots: MenuTreeNode[] = [];
    for (const item of allowedItems) {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(node);
      } else if (!item.parentId) {
        roots.push(node);
      }
    }

    // Sort children by order
    for (const node of itemMap.values()) {
      node.children.sort((a, b) => a.order - b.order);
    }
    roots.sort((a, b) => a.order - b.order);

    return roots;
  }

  async findAll(query: QueryMenuItemDto) {
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
    const item = await this.repository.findOne(scope, id);
    if (!item) {
      throw new ResourceNotFoundException("MenuItem", id);
    }
    return item;
  }

  async create(dto: CreateMenuItemDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    const existing = await this.repository.findByCode(scope, dto.code);
    if (existing) {
      throw new ResourceConflictException(
        `A menu item with code "${dto.code}" already exists`,
      );
    }

    return this.repository.create(scope, dto, callerId);
  }

  async update(id: number, dto: UpdateMenuItemDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    if (dto.code) {
      const existing = await this.repository.findByCode(scope, dto.code);
      if (existing && existing.id !== id) {
        throw new ResourceConflictException(
          `A menu item with code "${dto.code}" already exists`,
        );
      }
    }

    const updated = await this.repository.update(scope, id, dto, callerId);
    if (!updated) {
      throw new ResourceNotFoundException("MenuItem", id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();
    const deleted = await this.repository.softDelete(scope, id, callerId);
    if (!deleted) {
      throw new ResourceNotFoundException("MenuItem", id);
    }
  }
}
