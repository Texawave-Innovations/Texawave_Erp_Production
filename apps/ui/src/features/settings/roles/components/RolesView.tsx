"use client";

import type { Role } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useCreateRole, useRoles } from "../hooks";
import { RoleForm } from "./RoleForm";
import { RolePermissionsForm } from "./RolePermissionsForm";

const PAGE_SIZE = 10;

/**
 * Role → permission assignment screen (Docs/ARCHITECTURE.md §11, 2026-09-22
 * changelog entry) — replaces what used to require hand-editing
 * packages/database/prisma/seed.ts. Same screen-state pattern as
 * apps/ui/src/features/_reference/tags/components/TagsView.tsx
 * (Docs/DESIGN_SYSTEM.md §3): loading, error, permission-denied, empty,
 * populated.
 */
export function RolesView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const { toast } = useToast();

  const query = useRoles({ page, limit: PAGE_SIZE });
  const createMutation = useCreateRole();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to roles">
          Ask an administrator for the <code>settings.role.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const roles = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: { name: string }) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Role created", variant: "success" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Roles &amp; permissions
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New role</Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <EmptyState
            title="No roles yet"
            description="Create your first role to start assigning permissions."
          />
        </Card>
      ) : (
        <>
          <DataTable<Role>
            columns={[
              { header: "Name", cell: (role) => role.name },
              {
                header: "Status",
                cell: (role) => (
                  <StatusBadge
                    label={role.isActive ? "Active" : "Inactive"}
                    colorToken={role.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (role) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRole(role)}
                  >
                    Edit permissions
                  </Button>
                ),
              },
            ]}
            rows={roles}
            getRowKey={(role) => String(role.id)}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New role"
      >
        <RoleForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create role"
        />
      </Dialog>

      <Dialog
        open={editingRole !== null}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Permissions — ${editingRole.name}` : ""}
      >
        {editingRole ? (
          <RolePermissionsForm
            key={editingRole.id}
            roleId={editingRole.id}
            roleName={editingRole.name}
            onClose={() => setEditingRole(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
