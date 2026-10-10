"use client";

import { useMemo, useState } from "react";
import type { User } from "@texawave-erp/api-types";
import { Card, EmptyState, Input, StatusBadge } from "@texawave-erp/ui-kit";

export interface RoleUsersTabProps {
  roleId: number;
  roleName: string;
  allUsers: User[];
  isUsersCountPartial?: boolean | undefined;
  totalUsersInOrg?: number | undefined;
  loadedUsersCount?: number | undefined;
}

function getInitials(name: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function RoleUsersTab({
  roleId,
  roleName,
  allUsers,
  isUsersCountPartial,
  totalUsersInOrg,
  loadedUsersCount,
}: RoleUsersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter users assigned to this role
  const assignedUsers = useMemo(() => {
    return allUsers.filter((u) => u.roles?.some((r) => r.id === roleId));
  }, [allUsers, roleId]);

  // Apply search query filter
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return assignedUsers;
    return assignedUsers.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [assignedUsers, searchQuery]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Info Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search assigned users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-theme-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>
            {assignedUsers.length}{" "}
            {assignedUsers.length === 1 ? "user" : "users"} assigned to{" "}
            <strong className="text-gray-900 dark:text-white/90">
              {roleName}
            </strong>
          </span>
        </div>
      </div>

      {/* Safety Notice if total organization users exceed loaded page */}
      {isUsersCountPartial ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-theme-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          ℹ️ <strong>Note:</strong> Displaying assigned users from the first{" "}
          {loadedUsersCount} loaded organization members (total{" "}
          {totalUsersInOrg} members in organization). Authoritative server-side
          role filtering is not provided on the API.
        </div>
      ) : null}

      {/* Users Table */}
      {assignedUsers.length === 0 ? (
        <Card>
          <EmptyState
            title={`No users assigned to ${roleName}`}
            description="Assign this role to organization members in the Users directory to grant these permissions."
          />
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            No users match &ldquo;{searchQuery}&rdquo;.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-3">User</th>
                  <th className="px-3 py-3">Assigned Teams</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map((user) => {
                  const initials = getInitials(user.fullName);

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                              {user.fullName}
                            </span>
                            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.teams && user.teams.length > 0 ? (
                            user.teams.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                <span>{t.name}</span>
                                {t.isLead ? (
                                  <span className="rounded bg-brand-100 px-1 text-[10px] font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                                    Lead
                                  </span>
                                ) : null}
                              </span>
                            ))
                          ) : (
                            <span className="text-theme-xs text-gray-400 italic">
                              No team assigned
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <StatusBadge
                          label={user.isActive ? "Active" : "Inactive"}
                          colorToken={user.isActive ? "success" : "gray"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
