"use client";

import { Button, PageHeader } from "@texawave-erp/ui-kit";

export interface RolesHeaderProps {
  onCreateRole: () => void;
}

export function RolesHeader({ onCreateRole }: RolesHeaderProps) {
  return (
    <PageHeader
      breadcrumbs={["HR", "People", "Roles & Permissions"]}
      title="Roles & Permissions"
      description="Manage what each role can access across your organization."
      action={
        <Button onClick={onCreateRole} className="gap-2 shadow-theme-xs">
          <span className="text-base font-bold">+</span>
          <span>Create Role</span>
        </Button>
      }
    />
  );
}
