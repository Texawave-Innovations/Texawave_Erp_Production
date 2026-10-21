import type { ComponentType } from "react";
import type { Icon3DName, Icon3DSize } from "./types";
import { ICON_3D_SIZE_MAP } from "./types";
import {
  Icon3dDashboard,
  Icon3dHumanResources,
  Icon3dOverview,
  Icon3dTimeLeave,
  Icon3dOperations,
  Icon3dRecruitment,
  Icon3dPayroll,
  Icon3dCompliance,
  Icon3dDepartments,
  Icon3dDocuments,
  Icon3dOrgChart,
  Icon3dTeams,
  Icon3dAward,
  Icon3dPlus,
  Icon3dEdit,
  Icon3dDelete,
  Icon3dExport,
  Icon3dImport,
  Icon3dSearch,
  Icon3dBell,
  Icon3dCheerHands,
  Icon3dSales,
  Icon3dFinance,
  Icon3dPurchases,
  type Icon3DProps,
} from "./icons";

/**
 * Semantic 3D Icon Mapping Dictionary
 * Maps each audited semantic name to its high-fidelity 3D vector component.
 */
export const ICON_3D_REGISTRY: Record<
  Icon3DName,
  ComponentType<Icon3DProps>
> = {
  // Level 1 Modules
  dashboard: Icon3dDashboard,
  hr: Icon3dHumanResources,
  "human-resources": Icon3dHumanResources,
  commerce: Icon3dSales,
  sales: Icon3dSales,
  finance: Icon3dFinance,
  inventory: Icon3dDocuments,
  "inventory-scm": Icon3dDocuments,
  crm: Icon3dHumanResources,
  purchases: Icon3dPurchases,
  projects: Icon3dOrgChart,
  reports: Icon3dOverview,
  "master-list": Icon3dOverview,
  settings: Icon3dOperations,

  // Level 2 Categories
  overview: Icon3dOverview,
  people: Icon3dHumanResources,
  "time-leave": Icon3dTimeLeave,
  operations: Icon3dOperations,
  recruitment: Icon3dRecruitment,
  payroll: Icon3dPayroll,
  compliance: Icon3dCompliance,

  // Level 3 Submenus & Pages
  employees: Icon3dHumanResources,
  profiles: Icon3dHumanResources,
  documents: Icon3dDocuments,
  "employee-documents": Icon3dDocuments,
  "org-chart": Icon3dOrgChart,
  departments: Icon3dDepartments,
  teams: Icon3dTeams,
  attendance: Icon3dTimeLeave,
  regularization: Icon3dTimeLeave,
  "location-privilege": Icon3dOverview,
  award: Icon3dAward,
  "full-month-present": Icon3dAward,
  leaves: Icon3dTimeLeave,
  holidays: Icon3dTimeLeave,
  tasks: Icon3dOperations,
  expenses: Icon3dPayroll,
  "expense-approvals": Icon3dPayroll,
  tickets: Icon3dOperations,
  "exit-requests": Icon3dRecruitment,
  "access-control": Icon3dCompliance,
  users: Icon3dHumanResources,
  roles: Icon3dCompliance,
  menu: Icon3dDashboard,
  tags: Icon3dOperations,

  // Actions & Controls
  plus: Icon3dPlus,
  add: Icon3dPlus,
  edit: Icon3dEdit,
  delete: Icon3dDelete,
  view: Icon3dSearch,
  export: Icon3dExport,
  import: Icon3dImport,
  upload: Icon3dImport,
  download: Icon3dExport,
  search: Icon3dSearch,
  filter: Icon3dOperations,
  calendar: Icon3dTimeLeave,
  bell: Icon3dBell,
  user: Icon3dHumanResources,
  check: Icon3dCompliance,
  "cheer-hands": Icon3dCheerHands,
  celebration: Icon3dCheerHands,
  hi: Icon3dCheerHands,
  "waving-hand": Icon3dCheerHands,
};

/**
 * Resolve pixel size from size token or explicit number.
 */
export function resolve3DSize(size: Icon3DSize = "md"): number {
  if (typeof size === "number") return size;
  return ICON_3D_SIZE_MAP[size] ?? 24;
}
