import type { Permission } from "@texawave-erp/api-types";

export type PermissionScope = "own" | "team" | "all";

export interface ParsedAction {
  action: string;
  code: string;
  label: string;
  description: string;
  /** Independent permission record IDs */
  ownPermissionId?: number;
  teamPermissionId?: number;
  allPermissionId?: number;
  unscopedPermissionId?: number;
  /** All permission IDs associated with this action */
  allIds: number[];
  /** Primary permission ID to grant when toggled ON */
  primaryPermissionId: number;
}

export interface ParsedResource {
  resource: string;
  label: string;
  actions: ParsedAction[];
}

export interface ParsedModule {
  key: string;
  name: string;
  description: string;
  resources: ParsedResource[];
  totalPermissions: number;
  allPermissionIds: number[];
}

/** Human-friendly title-casing of dot/hyphen/underscore identifiers */
export function formatLabel(identifier: string): string {
  if (!identifier) return "";
  return identifier
    .split(/[-_.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Known descriptive metadata for standard ERP permissions */
const KNOWN_PERMISSION_META: Record<
  string,
  { label: string; description: string }
> = {
  "departments.department.read": {
    label: "View departments",
    description: "View department records and details.",
  },
  "departments.department.write": {
    label: "Manage departments",
    description: "Create, update and delete department records.",
  },
  "menu.item.read": {
    label: "View navigation items",
    description: "View available navigation menu items.",
  },
  "menu.item.write": {
    label: "Manage navigation items",
    description: "Create, update and manage navigation menu items.",
  },
  "reference.tags.read": {
    label: "View reference tags",
    description: "View reference tags and classification metadata.",
  },
  "reference.tags.write": {
    label: "Manage reference tags",
    description: "Create, update and manage reference tags.",
  },
  "settings.role.read": {
    label: "View roles",
    description: "View roles and their permissions.",
  },
  "settings.role.write": {
    label: "Manage roles",
    description: "Create, update and manage roles and permissions.",
  },
  "users.user.read": {
    label: "View users",
    description: "View user accounts and assignments.",
  },
  "users.user.write": {
    label: "Manage users",
    description: "Create, update users and manage their assignments.",
  },
};

/** Known descriptive metadata for standard ERP modules if available */
const KNOWN_MODULE_META: Record<string, { name: string; description: string }> =
  {
    users: {
      name: "Users & Teams",
      description: "Manage user accounts, assignments, and access policies",
    },
    settings: {
      name: "System Settings",
      description:
        "System-level configuration, roles, and administrative controls",
    },
    departments: {
      name: "Departments",
      description: "Organizational department structures and team hierarchies.",
    },
    menu: {
      name: "Navigation Menu",
      description: "Navigation menu structure and client visibility rules",
    },
    reference: {
      name: "Reference Tags",
      description: "Global entity tags and reference classification metadata",
    },
    hr: {
      name: "Human Resources",
      description: "Employees, attendance, leave requests, and payroll",
    },
  };

/**
 * Pure and defensive parser for catalog entries:
 * Handles:
 *  - `<module>.<resource>.<action>` (unscoped)
 *  - `<module>.<resource>.<action>.<scope>` (where scope is own | team | all)
 *  - Handles non-CRUD actions like "approve", "export", "review", etc.
 */
export function parsePermissionCatalog(catalog: Permission[]): ParsedModule[] {
  const moduleMap = new Map<
    string,
    {
      key: string;
      name: string;
      description: string;
      resourceMap: Map<string, Map<string, ParsedAction>>;
      allPermissionIds: number[];
    }
  >();

  for (const perm of catalog) {
    if (!perm || !perm.code) continue;
    const parts = perm.code.split(".");

    let moduleKey = "general";
    let resourceKey = "general";
    let actionKey = "access";
    let scope: PermissionScope | undefined = undefined;

    if (parts.length >= 4) {
      const lastPart = parts[parts.length - 1]?.toLowerCase();
      if (lastPart === "own" || lastPart === "team" || lastPart === "all") {
        scope = lastPart;
        moduleKey = parts[0] || "general";
        resourceKey = parts[1] || "general";
        actionKey = parts.slice(2, -1).join(".");
      } else {
        moduleKey = parts[0] || "general";
        resourceKey = parts[1] || "general";
        actionKey = parts.slice(2).join(".");
      }
    } else if (parts.length === 3) {
      moduleKey = parts[0] || "general";
      resourceKey = parts[1] || "general";
      actionKey = parts[2] || "access";
    } else if (parts.length === 2) {
      moduleKey = parts[0] || "general";
      resourceKey = parts[1] || "general";
      actionKey = "access";
    } else if (parts.length === 1) {
      moduleKey = parts[0] || "general";
    }

    if (!moduleMap.has(moduleKey)) {
      const meta = KNOWN_MODULE_META[moduleKey];
      moduleMap.set(moduleKey, {
        key: moduleKey,
        name: meta ? meta.name : formatLabel(moduleKey),
        description:
          meta?.description ||
          `Permissions for ${formatLabel(moduleKey)} module`,
        resourceMap: new Map(),
        allPermissionIds: [],
      });
    }

    const mod = moduleMap.get(moduleKey)!;
    mod.allPermissionIds.push(perm.id);

    if (!mod.resourceMap.has(resourceKey)) {
      mod.resourceMap.set(resourceKey, new Map());
    }

    const actionMap = mod.resourceMap.get(resourceKey)!;
    if (!actionMap.has(actionKey)) {
      const baseCode =
        parts.length >= 4 &&
        (parts[parts.length - 1]?.toLowerCase() === "own" ||
          parts[parts.length - 1]?.toLowerCase() === "team" ||
          parts[parts.length - 1]?.toLowerCase() === "all")
          ? parts.slice(0, -1).join(".")
          : perm.code;

      const knownMeta = KNOWN_PERMISSION_META[baseCode];

      const formattedResource = formatLabel(resourceKey);
      let humanLabel = knownMeta?.label ?? formatLabel(actionKey);
      if (!knownMeta) {
        if (actionKey === "read") {
          humanLabel = `View ${formattedResource.toLowerCase()}`;
        } else if (actionKey === "write") {
          humanLabel = `Manage ${formattedResource.toLowerCase()}`;
        } else if (actionKey === "create") {
          humanLabel = `Create ${formattedResource.toLowerCase()}`;
        } else if (actionKey === "update") {
          humanLabel = `Update ${formattedResource.toLowerCase()}`;
        } else if (actionKey === "delete") {
          humanLabel = `Delete ${formattedResource.toLowerCase()}`;
        }
      }

      let humanDesc = knownMeta?.description ?? perm.description;
      if (!humanDesc || humanDesc === perm.code) {
        if (actionKey === "read") {
          humanDesc = `View ${formattedResource.toLowerCase()} records and details.`;
        } else if (actionKey === "write") {
          humanDesc = `Create, update and delete ${formattedResource.toLowerCase()} records.`;
        } else {
          humanDesc = `${formatLabel(actionKey)} ${formattedResource.toLowerCase()} records.`;
        }
      }

      actionMap.set(actionKey, {
        action: actionKey,
        code: baseCode,
        label: humanLabel,
        description: humanDesc,
        allIds: [],
        primaryPermissionId: perm.id,
      });
    }

    const actionObj = actionMap.get(actionKey)!;
    if (scope === "own") {
      actionObj.ownPermissionId = perm.id;
    } else if (scope === "team") {
      actionObj.teamPermissionId = perm.id;
    } else if (scope === "all") {
      actionObj.allPermissionId = perm.id;
    } else {
      actionObj.unscopedPermissionId = perm.id;
    }

    // Keep all associated permission IDs updated
    if (!actionObj.allIds.includes(perm.id)) {
      actionObj.allIds.push(perm.id);
    }
    actionObj.primaryPermissionId =
      actionObj.allPermissionId ??
      actionObj.unscopedPermissionId ??
      actionObj.teamPermissionId ??
      actionObj.ownPermissionId ??
      perm.id;
  }

  // Convert to structured array
  const result: ParsedModule[] = [];
  for (const mod of moduleMap.values()) {
    const resources: ParsedResource[] = [];
    for (const [resKey, actionMap] of mod.resourceMap.entries()) {
      resources.push({
        resource: resKey,
        label: formatLabel(resKey),
        actions: Array.from(actionMap.values()),
      });
    }

    result.push({
      key: mod.key,
      name: mod.name,
      description: mod.description,
      resources,
      totalPermissions: mod.allPermissionIds.length,
      allPermissionIds: mod.allPermissionIds,
    });
  }

  return result;
}

/**
 * Deterministic coverage calculation formula:
 * assigned permission catalog entries / total permission catalog entries * 100
 */
export function calculateCoverage(
  assignedIds: Set<number> | number[],
  validCatalogIds: number[],
): number {
  if (!validCatalogIds || validCatalogIds.length === 0) return 0;
  const assignedSet =
    assignedIds instanceof Set ? assignedIds : new Set(assignedIds);
  let matchCount = 0;
  for (const id of validCatalogIds) {
    if (assignedSet.has(id)) {
      matchCount++;
    }
  }
  return Math.round((matchCount / validCatalogIds.length) * 100);
}
