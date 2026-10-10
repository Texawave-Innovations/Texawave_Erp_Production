"use client";

import { useMemo, useState } from "react";
import type { Role } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useUsers } from "../../../users/hooks";
import { RoleMenuMatrixView } from "../../role-menu-matrix/components/RoleMenuMatrixView";
import {
  useCreateRole,
  usePermissionCatalog,
  useRole,
  useRoles,
  useSetRolePermissions,
  useUpdateRole,
} from "../hooks";
import {
  type ParsedAction,
  parsePermissionCatalog,
} from "../utils/permission-parser";
import { RoleForm } from "./RoleForm";
import { RolesHeader } from "./RolesHeader";
import { RoleSelector } from "./RoleSelector";
import { type RoleTabKey, RoleTabs } from "./RoleTabs";
import { RolePermissionsTab } from "./tabs/RolePermissionsTab";
import { RoleUsersTab } from "./tabs/RoleUsersTab";

const MAX_USERS_PAGE = 100;
const MAX_ROLES_PAGE = 100;

export function RolesView() {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<RoleTabKey>("permissions");

  // Modal dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuAccessRole, setMenuAccessRole] = useState<Role | null>(null);

  // Local uncommitted permission edits for the selected role
  // null = no uncommitted edits, derive directly from loaded role
  const [draftPermissions, setDraftPermissions] = useState<Set<number> | null>(
    null,
  );

  const { toast } = useToast();

  // Queries
  const rolesQuery = useRoles({ page: 1, limit: MAX_ROLES_PAGE });
  const catalogQuery = usePermissionCatalog();
  const usersQuery = useUsers({ page: 1, limit: MAX_USERS_PAGE });

  // Mutations
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const setPermissionsMutation = useSetRolePermissions();

  const roles = useMemo(
    () => rolesQuery.data?.data ?? [],
    [rolesQuery.data?.data],
  );
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const allUsers = useMemo(
    () => usersQuery.data?.data ?? [],
    [usersQuery.data?.data],
  );
  const usersMeta = usersQuery.data?.meta;

  // Selected role resolution
  const selectedRole = useMemo(() => {
    if (roles.length === 0) return null;
    if (selectedRoleId !== null) {
      const match = roles.find((r) => r.id === selectedRoleId);
      if (match) return match;
    }
    return roles[0] || null;
  }, [roles, selectedRoleId]);

  // Selected role detail (with server-granted permissions)
  const roleDetailQuery = useRole(selectedRole?.id);

  // Parse catalog dynamically into modules, resources, actions, scopes
  const parsedModules = useMemo(() => {
    return parsePermissionCatalog(catalog);
  }, [catalog]);

  // Derive assigned user counts by role
  const userCountsByRoleId = useMemo(() => {
    const map = new Map<number, number>();
    for (const user of allUsers) {
      if (!user.roles) continue;
      for (const r of user.roles) {
        map.set(r.id, (map.get(r.id) ?? 0) + 1);
      }
    }
    return map;
  }, [allUsers]);

  // Active permission set for the selected role
  const serverGrantedIds = useMemo(() => {
    return new Set(roleDetailQuery.data?.permissions.map((p) => p.id) ?? []);
  }, [roleDetailQuery.data]);

  const effectiveSelectedIds = draftPermissions ?? serverGrantedIds;
  const hasChanges = draftPermissions !== null;

  const isUsersCountPartial = Boolean(
    usersMeta && usersMeta.total > usersMeta.limit,
  );

  // Loading states
  if (rolesQuery.isPending || catalogQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // Error states
  if (rolesQuery.isError || catalogQuery.isError) {
    const error = rolesQuery.error || catalogQuery.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access Denied">
          You need the <code>settings.role.read</code> permission to view and
          manage organization roles.
        </Alert>
      );
    }
    return (
      <ErrorState
        onRetry={() => {
          void rolesQuery.refetch();
          void catalogQuery.refetch();
        }}
      />
    );
  }

  // Permission mutation handlers
  function handleToggleAction(action: ParsedAction) {
    setDraftPermissions((prev) => {
      const next = new Set(prev ?? serverGrantedIds);
      const isGranted = action.allIds.some((id) => next.has(id));
      if (isGranted) {
        for (const id of action.allIds) {
          next.delete(id);
        }
      } else {
        next.add(action.primaryPermissionId);
      }
      return next;
    });
  }

  function handleGrantModule(moduleKey: string) {
    const targetModule = parsedModules.find((m) => m.key === moduleKey);
    if (!targetModule) return;
    setDraftPermissions((prev) => {
      const next = new Set(prev ?? serverGrantedIds);
      for (const id of targetModule.allPermissionIds) {
        next.add(id);
      }
      return next;
    });
  }

  function handleRevokeModule(moduleKey: string) {
    const targetModule = parsedModules.find((m) => m.key === moduleKey);
    if (!targetModule) return;
    setDraftPermissions((prev) => {
      const next = new Set(prev ?? serverGrantedIds);
      for (const id of targetModule.allPermissionIds) {
        next.delete(id);
      }
      return next;
    });
  }

  async function handleSavePermissions() {
    if (!selectedRole) return;
    try {
      await setPermissionsMutation.mutateAsync({
        id: selectedRole.id,
        input: { permissionIds: Array.from(effectiveSelectedIds) },
      });
      setDraftPermissions(null);
      toast({
        title: `Permissions saved for "${selectedRole.name}"`,
        variant: "success",
      });
    } catch {
      toast({ title: "Could not save permissions", variant: "error" });
    }
  }

  function handleDiscardPermissions() {
    setDraftPermissions(null);
  }

  function handleSelectRole(role: Role) {
    if (hasChanges) {
      const discard = window.confirm(
        "You have unsaved permission changes. Discard them and switch role?",
      );
      if (!discard) return;
    }
    setSelectedRoleId(role.id);
    setDraftPermissions(null);
  }

  // Create role handler
  async function handleCreateRole(values: { name: string }) {
    const created = await createMutation.mutateAsync(values);
    setCreateOpen(false);
    setSelectedRoleId(created.id);
    setDraftPermissions(null);
    toast({ title: `Role "${created.name}" created`, variant: "success" });
  }

  // Edit role handler
  async function handleUpdateRole(values: {
    name: string;
    isActive?: boolean;
  }) {
    if (!selectedRole) return;
    await updateMutation.mutateAsync({
      id: selectedRole.id,
      input: values,
    });
    setEditOpen(false);
    toast({ title: `Role "${values.name}" updated`, variant: "success" });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header (Clean breadcrumb, title, subtitle, and Create Role CTA) */}
      <RolesHeader onCreateRole={() => setCreateOpen(true)} />

      {/* Empty State when no roles exist */}
      {roles.length === 0 ? (
        <Card>
          <EmptyState
            title="No Roles Defined"
            description="Create your first organization role to start structuring access policies and assigning members."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                Create First Role
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* 2. Compact Role Selection & Summary Area matching Reference UI */}
          <RoleSelector
            roles={roles}
            selectedRole={selectedRole}
            assignedUsersCount={
              selectedRole ? (userCountsByRoleId.get(selectedRole.id) ?? 0) : 0
            }
            onSelectRole={handleSelectRole}
            onEditRole={() => setEditOpen(true)}
            onMenuAccess={() => setMenuAccessRole(selectedRole)}
          />

          {/* 3. Main Navigation Tabs: Permissions | Users */}
          {selectedRole ? (
            <div className="flex flex-col gap-6">
              <RoleTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                assignedUsersCount={
                  userCountsByRoleId.get(selectedRole.id) ?? 0
                }
              />

              {/* 4. Tab Workspace Content */}
              {activeTab === "permissions" ? (
                <RolePermissionsTab
                  modules={parsedModules}
                  selectedPermissionIds={effectiveSelectedIds}
                  isSaving={setPermissionsMutation.isPending}
                  hasChanges={hasChanges}
                  onToggleAction={handleToggleAction}
                  onGrantModule={handleGrantModule}
                  onRevokeModule={handleRevokeModule}
                  onSave={() => void handleSavePermissions()}
                  onDiscard={handleDiscardPermissions}
                />
              ) : null}

              {activeTab === "users" ? (
                <RoleUsersTab
                  roleId={selectedRole.id}
                  roleName={selectedRole.name}
                  allUsers={allUsers}
                  isUsersCountPartial={isUsersCountPartial}
                  totalUsersInOrg={usersMeta?.total}
                  loadedUsersCount={usersMeta?.limit}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* Create Role Modal Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Role"
      >
        <RoleForm
          onSubmit={handleCreateRole}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create Role"
        />
      </Dialog>

      {/* Edit Role Modal Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Role — ${selectedRole?.name ?? ""}`}
      >
        {selectedRole ? (
          <RoleForm
            key={selectedRole.id}
            initialValues={{
              name: selectedRole.name,
              isActive: selectedRole.isActive,
            }}
            onSubmit={handleUpdateRole}
            onCancel={() => setEditOpen(false)}
            submitLabel="Save Changes"
          />
        ) : null}
      </Dialog>

      <Dialog
        open={menuAccessRole !== null}
        onClose={() => setMenuAccessRole(null)}
        title={menuAccessRole ? `Menu access — ${menuAccessRole.name}` : ""}
      >
        {menuAccessRole ? (
          <RoleMenuMatrixView
            key={menuAccessRole.id}
            roleId={menuAccessRole.id}
            roleName={menuAccessRole.name}
            onClose={() => setMenuAccessRole(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
