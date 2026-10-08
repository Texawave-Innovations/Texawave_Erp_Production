"use client";

import { useMemo, useState } from "react";
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
import { Plus, Pencil, Shield, Users as UsersIcon, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementToolbar } from "@/components/layout/ManagementToolbar";
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

/**
 * Enterprise Users Management View.
 * Conforms to Section 11, 12 & Docs/DESIGN_SYSTEM.md.
 */
export function UsersView() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [assigningRolesUser, setAssigningRolesUser] = useState<User | null>(
    null,
  );
  const [assigningTeamsUser, setAssigningTeamsUser] = useState<User | null>(
    null,
  );
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { toast } = useToast();

  const query = useUsers({
    page,
    limit: PAGE_SIZE,
    ...(searchTerm ? { search: searchTerm } : {}),
  });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const rawUsers = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const meta = query.data?.meta;

  // Extract distinct roles and teams for filter dropdowns
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    rawUsers.forEach((u) => u.roles?.forEach((r) => set.add(r.name)));
    return Array.from(set).sort();
  }, [rawUsers]);

  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    rawUsers.forEach((u) => u.teams?.forEach((t) => set.add(t.name)));
    return Array.from(set).sort();
  }, [rawUsers]);

  // Apply client-side filters
  const filteredUsers = useMemo(() => {
    return rawUsers.filter((u) => {
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (roleFilter !== "all" && !u.roles?.some((r) => r.name === roleFilter))
        return false;
      if (teamFilter !== "all" && !u.teams?.some((t) => t.name === teamFilter))
        return false;
      return true;
    });
  }, [rawUsers, statusFilter, roleFilter, teamFilter]);

  const hasActiveFilters = Boolean(
    searchTerm ||
    roleFilter !== "all" ||
    teamFilter !== "all" ||
    statusFilter !== "all",
  );

  function handleClearFilters() {
    setSearchTerm("");
    setRoleFilter("all");
    setTeamFilter("all");
    setStatusFilter("all");
  }

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

  async function handleDeleteConfirm() {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync(deletingUser.id);
      toast({
        title: `Deleted "${deletingUser.fullName}"`,
        variant: "success",
      });
      setDeletingUser(null);
    } catch {
      toast({
        title: `Could not delete "${deletingUser.fullName}"`,
        variant: "error",
      });
    }
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-14 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Shared Page Header */}
      <PageHeader
        breadcrumbs={["HR", "People", "Users"]}
        title="Users"
        description="Manage user accounts, roles and team access."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            className="gap-2 shadow-theme-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New user</span>
          </Button>
        }
      />

      {/* 2. Management Toolbar Card */}
      <ManagementToolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search users..."
        searchLabel="Search users"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <label htmlFor="user-role-filter" className="sr-only">
              Filter by role
            </label>
            <select
              id="user-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300"
            >
              <option value="all">Role: All roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Team Filter */}
            <label htmlFor="user-team-filter" className="sr-only">
              Filter by team
            </label>
            <select
              id="user-team-filter"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300"
            >
              <option value="all">Team: All teams</option>
              {availableTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <label htmlFor="user-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="user-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300"
            >
              <option value="all">Status: All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
      />

      {/* 3. Table / Results Content */}
      {rawUsers.length === 0 ? (
        <Card>
          <EmptyState
            title="No users yet"
            description="Create your first user to grant access and assign roles."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                + New user
              </Button>
            }
          />
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <EmptyState
            title="No users match your filters"
            description="Try searching with a different keyword or clear the active filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable<User>
            columns={[
              {
                header: "#",
                className:
                  "w-12 text-center text-gray-400 font-mono text-theme-xs",
                headerClassName: "w-12 text-center text-theme-xs",
                cell: (u) => (
                  <span className="font-mono text-gray-400">
                    {(page - 1) * PAGE_SIZE + filteredUsers.indexOf(u) + 1}
                  </span>
                ),
              },
              {
                header: "Name",
                cell: (u) => (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-semibold text-indigo-700 text-xs dark:bg-indigo-950 dark:text-indigo-300">
                      {u.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {u.fullName}
                    </span>
                  </div>
                ),
              },
              {
                header: "Email",
                cell: (u) => (
                  <span className="text-gray-600 dark:text-gray-400 text-theme-xs">
                    {u.email}
                  </span>
                ),
              },
              {
                header: "Role",
                cell: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.roles?.length ? (
                      u.roles.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        >
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-theme-xs text-gray-400">—</span>
                    )}
                  </div>
                ),
              },
              {
                header: "Team",
                cell: (u) => (
                  <div className="flex flex-wrap gap-1">
                    {u.teams?.length ? (
                      u.teams.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {t.name}
                          {t.isLead ? " (Lead)" : ""}
                        </span>
                      ))
                    ) : (
                      <span className="text-theme-xs text-gray-400">—</span>
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
                header: "Actions",
                className: "text-right w-16",
                headerClassName: "text-right w-16",
                cell: (u) => (
                  <ActionMenu
                    ariaLabel={`Actions for ${u.fullName}`}
                    items={[
                      {
                        label: "Edit user",
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        onClick: () => setEditingUser(u),
                      },
                      {
                        label: "Manage roles",
                        icon: <Shield className="h-3.5 w-3.5" />,
                        onClick: () => setAssigningRolesUser(u),
                      },
                      {
                        label: "Manage teams",
                        icon: <UsersIcon className="h-3.5 w-3.5" />,
                        onClick: () => setAssigningTeamsUser(u),
                      },
                      {
                        label: "Delete user",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        variant: "destructive",
                        onClick: () => setDeletingUser(u),
                      },
                    ]}
                  />
                ),
              },
            ]}
            rows={filteredUsers}
            getRowKey={(u) => String(u.id)}
          />

          {meta && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Showing 1–{filteredUsers.length} of {meta.total} users
              </span>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Create Modal Dialog */}
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

      {/* 5. Edit Modal Dialog */}
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

      {/* 6. Assign Roles Modal Dialog */}
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

      {/* 7. Assign Teams Modal Dialog */}
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

      {/* 8. Accessible Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete user"
        itemName={deletingUser?.fullName ?? ""}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
