import type { SVGAttributes } from "react";

export type Icon3DSize = "sm" | "md" | "lg" | "xl" | number;

export const ICON_3D_SIZE_MAP: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 18, // 16-18px: dense tables, compact row actions
  md: 22, // 20-24px: submenus, category items, secondary buttons
  lg: 28, // 26-30px: page hero banners, feature section headers
  xl: 34, // 32-36px: primary top navigation modules
};

export type Icon3DName =
  // Level 1 Modules
  | "dashboard"
  | "hr"
  | "human-resources"
  | "commerce"
  | "sales"
  | "finance"
  | "inventory"
  | "inventory-scm"
  | "crm"
  | "purchases"
  | "projects"
  | "reports"
  | "master-list"
  | "settings"
  // Level 2 Categories
  | "overview"
  | "people"
  | "time-leave"
  | "operations"
  | "recruitment"
  | "payroll"
  | "compliance"
  // Level 3 Submenus & HR Pages
  | "employees"
  | "profiles"
  | "documents"
  | "employee-documents"
  | "org-chart"
  | "departments"
  | "teams"
  | "attendance"
  | "regularization"
  | "location-privilege"
  | "award"
  | "full-month-present"
  | "leaves"
  | "holidays"
  | "tasks"
  | "expenses"
  | "expense-approvals"
  | "tickets"
  | "exit-requests"
  | "access-control"
  | "users"
  | "roles"
  | "menu"
  | "tags"
  // Level 5 Contextual Actions
  | "plus"
  | "add"
  | "edit"
  | "delete"
  | "view"
  | "export"
  | "import"
  | "upload"
  | "download"
  | "search"
  | "filter"
  | "calendar"
  | "bell"
  | "user"
  | "check"
  | "cheer-hands"
  | "celebration"
  | "hi"
  | "waving-hand";

export interface Semantic3DIconProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  "name"
> {
  name: Icon3DName;
  size?: Icon3DSize;
  className?: string;
  alt?: string;
}
