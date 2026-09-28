"use client";

import type { User } from "@texawave-erp/api-types";
import {
  ApiError,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from "@texawave-erp/core";
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
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "../hooks";
import { AssignRolesModal } from "./AssignRolesModal";
import { AssignTeamsModal } from "./AssignTeamsModal";
import { UserForm } from "./UserForm";

const PAGE_SIZE = 10;

export function UsersView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [assigningRolesUser, setAssigningRolesUser] = useState<User | null>(
    null,
  );
  const [assigningTeamsUser, setAssigningTeamsUser] = useState<User | null>(
    null,
  );
  const { toast } = useToast();

  const query = useUsers({ page, limit: PAGE_SIZE });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

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
        <Alert variant="warning" title="Access Denied">
          You do not have permission to view users.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const users = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(
    values: CreateUserFormValues | UpdateUserFormValues,
  ) {
    try {
      const v = values as CreateUserFormValues;
      await createMutation.mutateAsync({
        email: v.email,
        fullName: v.fullName,
        password: v.password,
      });
      setCreateOpen(false);
      toast({ title: "User created", variant: "success" });
    } catch {
      toast({ title: "Could not create user", variant: "error" });
    }
  }

  async function handleUpdate(
    values: CreateUserFormValues | UpdateUserFormValues,
  ) {
    if (!editingUser) return;
    try {
      const v = values as UpdateUserFormValues;
      const input: { fullName?: string; email?: string; isActive?: boolean } =
        {};
      if (v.fullName !== undefined) input.fullName = v.fullName;
      if (v.email !== undefined) input.email = v.email;
      if (v.isActive !== undefined) input.isActive = v.isActive;

      await updateMutation.mutateAsync({
        id: editingUser.id,
        input,
      });
      setEditingUser(null);
      toast({ title: "User updated", variant: "success" });
    } catch {
      toast({ title: "Could not update user", variant: "error" });
    }
  }

  async function handleDelete(u: User) {
    try {
      await deleteMutation.mutateAsync(u.id);
      toast({ title: `Deleted "${u.fullName}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${u.fullName}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Users
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New user</Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <EmptyState
            title="No users yet"
            description="Create your first user to grant access to the system."
          />
        </Card>
      ) : (
        <>
          <DataTable<User>
            columns={[
              { header: "Name", cell: (u) => u.fullName },
              { header: "Email", cell: (u) => u.email },
              {
                header: "Roles",
                cell: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.roles?.length ? (
                      u.roles.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-theme-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        >
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-theme-xs text-gray-400">None</span>
                    )}
                  </div>
                ),
              },
              {
                header: "Teams",
                cell: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.teams?.length ? (
                      u.teams.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {t.name}
                          {t.isLead ? " (Lead)" : ""}
                        </span>
                      ))
                    ) : (
                      <span className="text-theme-xs text-gray-400">None</span>
                    )}
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (u) => (
                  <StatusBadge
                    label={u.isActive ? "Active" : "Inactive"}
                    colorToken={u.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (u) => (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssigningRolesUser(u)}
                    >
                      Roles
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssigningTeamsUser(u)}
                    >
                      Teams
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingUser(u)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(u)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={users}
            getRowKey={(u) => String(u.id)}
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
        title="New user"
      >
        <UserForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create user"
        />
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit user"
      >
        {editingUser && (
          <UserForm
            isEdit
            initialValues={{
              email: editingUser.email,
              fullName: editingUser.fullName,
              isActive: editingUser.isActive,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditingUser(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(assigningRolesUser)}
        onClose={() => setAssigningRolesUser(null)}
        title={`Assign Roles — ${assigningRolesUser?.fullName}`}
      >
        {assigningRolesUser && (
          <AssignRolesModal
            key={assigningRolesUser.id}
            userId={assigningRolesUser.id}
            userName={assigningRolesUser.fullName}
            currentRoleIds={assigningRolesUser.roles.map((r) => r.id)}
            onClose={() => setAssigningRolesUser(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(assigningTeamsUser)}
        onClose={() => setAssigningTeamsUser(null)}
        title={`Assign Teams — ${assigningTeamsUser?.fullName}`}
      >
        {assigningTeamsUser && (
          <AssignTeamsModal
            key={assigningTeamsUser.id}
            userId={assigningTeamsUser.id}
            userName={assigningTeamsUser.fullName}
            currentTeams={assigningTeamsUser.teams}
            onClose={() => setAssigningTeamsUser(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
