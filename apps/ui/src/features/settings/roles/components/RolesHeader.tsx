"use client";

import { Button } from "@texawave-erp/ui-kit";

export interface RolesHeaderProps {
  onCreateRole: () => void;
}

export function RolesHeader({ onCreateRole }: RolesHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb path */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          <li>HR</li>
          <li className="text-gray-400 dark:text-gray-600">›</li>
          <li>People</li>
          <li className="text-gray-400 dark:text-gray-600">›</li>
          <li className="font-semibold text-gray-900 dark:text-white/90">
            Roles &amp; Permissions
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-title-sm font-bold tracking-tight text-gray-900 dark:text-white/90">
            Roles &amp; Permissions
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Manage what each role can access across your organization.
          </p>
        </div>

        <div>
          <Button onClick={onCreateRole} className="gap-2 shadow-theme-xs">
            <span className="text-base font-bold">+</span>
            <span>Create Role</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
