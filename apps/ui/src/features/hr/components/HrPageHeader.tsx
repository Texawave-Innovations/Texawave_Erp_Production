"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  PageHeader,
  Semantic3DIcon,
  type Icon3DName,
} from "@texawave-erp/ui-kit";

export interface HrPageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon | undefined;
  icon3d?: Icon3DName | undefined;
  badge?: ReactNode | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

const HR_TITLE_3D_MAP: Record<string, Icon3DName> = {
  dashboard: "dashboard",
  employees: "employees",
  profiles: "profiles",
  "employee documents": "documents",
  "org chart": "org-chart",
  departments: "departments",
  teams: "teams",
  attendance: "attendance",
  regularization: "regularization",
  "location privilege": "location-privilege",
  "full month present": "award",
  leaves: "leaves",
  holidays: "holidays",
  tasks: "tasks",
  "expense approvals": "expenses",
  "employee tickets": "tickets",
  tickets: "tickets",
  recruitment: "recruitment",
  "exit requests": "exit-requests",
  payroll: "payroll",
  compliance: "compliance",
};

/**
 * Standardized TexaOne HR Page Header compatibility wrapper.
 * Renders dimensional 3D semantic hero icons within a white squircle container.
 * Delegates to the global UI Kit PageHeader with variant="banner".
 * Conforms to Docs/DESIGN_SYSTEM.md.
 */
export function HrPageHeader({
  icon,
  icon3d,
  title,
  ...props
}: HrPageHeaderProps) {
  const normalizedTitle = title.trim().toLowerCase();
  const matched3d = icon3d ?? HR_TITLE_3D_MAP[normalizedTitle];

  const headerIcon = matched3d ? (
    <Semantic3DIcon name={matched3d} size={30} alt={title} />
  ) : (
    icon
  );

  return (
    <PageHeader variant="banner" title={title} icon={headerIcon} {...props} />
  );
}
