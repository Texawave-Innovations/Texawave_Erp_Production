"use client";

import type { User } from "@texawave-erp/api-types";
import { AlertTriangle } from "lucide-react";
import {
  Alert,
  Card,
  DataTable,
  EmptyState,
  StatusBadge,
} from "@texawave-erp/ui-kit";

/**
 * Users holding the role, with their teams. A team-scoped grant is empty for
 * a user with no team, so that combination is flagged.
 */
export function RoleMembersPanel({
  roleName,
  members,
  partial,
  hasTeamScope,
}: {
  roleName: string;
  members: readonly User[];
  /** True when only the first page of users was loaded. */
  partial: boolean;
  /** The role grants at least one permission at Team scope. */
  hasTeamScope: boolean;
}) {
  const withoutTeams = hasTeamScope
    ? members.filter((m) => m.teams.length === 0)
    : [];
  return (
    <div className="flex flex-col gap-3">
      {partial ? (
        <Alert variant="info" title="Showing members among the first 100 users">
          The organization has more users than one page; manage everyone from
          Admin → Users.
        </Alert>
      ) : null}
      {withoutTeams.length > 0 ? (
        <Alert variant="warning" title="Team scope with no team">
          {withoutTeams.length} member
          {withoutTeams.length === 1 ? " has" : "s have"} no team, so this
          role's Team-scoped permissions show them nothing. Assign teams in
          Admin → Users.
        </Alert>
      ) : null}
      {members.length === 0 ? (
        <Card>
          <EmptyState
            title="Nobody has this role"
            description={`Assign “${roleName}” to users from Admin → Users.`}
          />
        </Card>
      ) : (
        <DataTable
          caption={`Users with the ${roleName} role`}
          rows={[...members]}
          getRowKey={(u) => String(u.id)}
          columns={[
            {
              header: "User",
              cell: (u) => (
                <span className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {u.fullName}
                  </span>
                  <span className="text-theme-xs text-gray-500">{u.email}</span>
                </span>
              ),
            },
            {
              header: "Teams",
              cell: (u) =>
                u.teams.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-theme-xs text-gray-400">
                    {hasTeamScope ? (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-warning-600"
                        aria-hidden
                      />
                    ) : null}
                    No team
                  </span>
                ) : (
                  <span className="text-theme-xs text-gray-700 dark:text-gray-300">
                    {u.teams
                      .map((t) => `${t.name}${t.isLead ? " (lead)" : ""}`)
                      .join(", ")}
                  </span>
                ),
            },
            {
              header: "Other roles",
              cell: (u) => (
                <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                  {u.roles
                    .filter((r) => r.name !== roleName)
                    .map((r) => r.name)
                    .join(", ") || "—"}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (u) => (
                <StatusBadge
                  label={u.isActive ? "Active" : "Disabled"}
                  colorToken={u.isActive ? "success" : "gray"}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
