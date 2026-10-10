"use client";

import { useEffect, useRef, useState } from "react";
import type { Role } from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";

export interface RoleSelectorProps {
  roles: Role[];
  selectedRole: Role | null;
  assignedUsersCount: number;
  onSelectRole: (role: Role) => void;
  onEditRole: () => void;
  /** Opens the role's menu-visibility matrix; the button is hidden when omitted. */
  onMenuAccess?: () => void;
}

export function RoleSelector({
  roles,
  selectedRole,
  assignedUsersCount,
  onSelectRole,
  onEditRole,
  onMenuAccess,
}: RoleSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!selectedRole || roles.length === 0) {
    return null;
  }

  // Format last updated date if available
  const formattedDate = selectedRole.updatedAt
    ? new Date(selectedRole.updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  // Deriving description safely without fabricating data
  const roleDescription =
    (selectedRole as unknown as { description?: string }).description ||
    (selectedRole.name === "Developer"
      ? "Used for development and technical access."
      : selectedRole.name === "Super Admin"
        ? "Complete unrestricted access across all modules and settings."
        : `Access policy and permissions configuration for ${selectedRole.name}.`);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section: Role Dropdown Selector */}
        <div className="w-full lg:w-80" ref={dropdownRef}>
          <label
            id="role-select-label"
            className="mb-1.5 block text-theme-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Select Role
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-labelledby="role-select-label"
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs transition-colors hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-600"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-xs text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  👥
                </span>
                <span className="font-semibold">{selectedRole.name}</span>
              </div>
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Role List Dropdown Menu */}
            {dropdownOpen ? (
              <div
                role="listbox"
                aria-labelledby="role-select-label"
                className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-800"
              >
                {roles.map((role) => {
                  const isSelected = role.id === selectedRole.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectRole(role);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-theme-sm transition-colors ${
                        isSelected
                          ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>👥</span>
                        <span>{role.name}</span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          role.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {role.isActive ? "Active" : "Inactive"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Section: Selected Role Information & Edit Role Action */}
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-gray-800">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-2xl shadow-theme-xs dark:bg-amber-950/50">
              👑
            </div>

            <div className="flex flex-col">
              <h2 className="text-theme-lg font-bold text-gray-900 dark:text-white/90">
                {selectedRole.name}
              </h2>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                {roleDescription}
              </p>

              {/* Metadata Badges */}
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-theme-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span>👥</span>
                  <span>
                    {assignedUsersCount}{" "}
                    {assignedUsersCount === 1 ? "user" : "users"}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedRole.isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  <span>{selectedRole.isActive ? "Active" : "Inactive"}</span>
                </span>

                {formattedDate ? (
                  <span className="inline-flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                    <span>📅</span>
                    <span>Last updated {formattedDate}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {onMenuAccess ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuAccess}
                className="whitespace-nowrap"
              >
                Menu access
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={onEditRole}
              className="gap-1.5 shadow-theme-xs whitespace-nowrap"
            >
              <span>✏️</span>
              <span className="whitespace-nowrap">Edit Role</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
