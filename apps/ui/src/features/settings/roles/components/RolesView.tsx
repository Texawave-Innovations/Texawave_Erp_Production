"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton, Tabs } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useUsers } from "../../../users/hooks";
import { usePermissionCatalog, useRoles } from "../hooks";
import { EffectiveAccessView } from "./EffectiveAccessView";
import { RolesWorkspace } from "./RolesWorkspace";

const PAGE = 100;
type Section = "roles" | "access";

/**
 * Admin → Roles ("Access control"). Roles: edit what each role can see and
 * do, including sidebar visibility. Who has access: a user's effective
 * permissions and where they come from. The API remains the authority for
 * every rule (settings.role.*, users.user.read).
 */
export function RolesView() {
  const canReadUsers = usePermission("users.user.read");
  const roles = useRoles({ page: 1, limit: PAGE });
  const catalog = usePermissionCatalog();
  const users = useUsers({ page: 1, limit: PAGE });
  const [section, setSection] = useState<Section>("roles");

  const userList = useMemo(
    () => (canReadUsers ? (users.data?.data ?? []) : []),
    [canReadUsers, users.data],
  );
  const usersPartial = Boolean(
    users.data && users.data.meta.total > users.data.meta.limit,
  );

  if (roles.isPending || catalog.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[28rem] w-full" />
      </div>
    );
  }
  if (roles.isError || catalog.isError) {
    const error = roles.error ?? catalog.error;
    return error instanceof ApiError && error.isPermissionError ? (
      <Alert variant="warning" title="You don't have access to roles">
        Ask an administrator for the <code>settings.role.read</code> permission.
      </Alert>
    ) : (
      <ErrorState
        onRetry={() => {
          void roles.refetch();
          void catalog.refetch();
        }}
      />
    );
  }

  const tabs = [
    { id: "roles" as const, label: "Roles" },
    ...(canReadUsers
      ? [{ id: "access" as const, label: "Who has access" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Access control
        </h1>
        <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
          Roles decide what people can see and do, and at what scope. Changes
          apply from each user's next request.
        </p>
      </div>
      {users.isError && canReadUsers ? (
        <Alert variant="warning" title="Users could not be loaded">
          Member counts and “Who has access” are unavailable until users load.
        </Alert>
      ) : null}
      <Tabs
        label="Access control sections"
        idPrefix="access"
        tabs={tabs}
        value={section}
        onChange={setSection}
      >
        {section === "roles" ? (
          <RolesWorkspace
            roles={roles.data.data}
            catalog={catalog.data}
            users={userList}
            usersPartial={usersPartial}
          />
        ) : null}
        {section === "access" ? (
          <EffectiveAccessView
            users={userList}
            catalog={catalog.data}
            usersPartial={usersPartial}
          />
        ) : null}
      </Tabs>
    </div>
  );
}
