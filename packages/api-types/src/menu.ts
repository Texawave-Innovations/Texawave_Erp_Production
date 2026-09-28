// Wire types for Menu module

export interface MenuItem {
  id: number;
  organizationId: number;
  code: string;
  label: string;
  path: string | null;
  icon: string | null;
  order: number;
  parentId: number | null;
  permission: string | null;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

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

export interface CreateMenuItemInput {
  code: string;
  label: string;
  path?: string;
  icon?: string;
  order?: number;
  parentId?: number;
  permission?: string;
  isActive?: boolean;
  customFields?: Record<string, unknown>;
}

export type UpdateMenuItemInput = Partial<CreateMenuItemInput>;

export interface QueryMenuItemsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
