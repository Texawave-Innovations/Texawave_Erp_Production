"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, ShieldCheck } from "lucide-react";
import type { Permission, RoleListItem, User } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  useCloneRole,
  useCreateRole,
  useRole,
  useSetRolePermissions,
  useUpdateRole,
} from "../hooks";
import {
  buildAccessModel,
  diffGrants,
  dutyConflicts,
  levelOf,
  type AccessSection,
} from "../utils/access-model";
import { PermissionMatrix } from "./PermissionMatrix";
import { ReviewChangesDialog, type ReviewWarning } from "./ReviewChangesDialog";
import { RoleForm } from "./RoleForm";
import { RoleHistoryPanel } from "./RoleHistoryPanel";
import { RoleList } from "./RoleList";
import { RoleMembersPanel } from "./RoleMembersPanel";
import { RoleNavigationPanel } from "./RoleNavigationPanel";

type EditorTab = "permissions" | "navigation" | "members" | "history";

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/** Readable message for a failed save; the review dialog shows it. */
function saveError(error: unknown): Error {
  if (error instanceof ApiError) {
    if (error.errorCode === "VERSION_CONFLICT") {
      return new Error(
        "Someone else changed this role while you were editing. Their version is now loaded underneath and your edits are kept — review the changes again.",
      );
    }
    if (error.errorCode === "ACCESS_LOCKOUT") return new Error(error.message);
  }
  return error instanceof Error
    ? error
    : new Error("Saving failed. Try again.");
}

/**
 * Roles tab of Access control: pick a role on the left, edit it on the right.
 * Permissions and Navigation edit ONE draft grant set; nothing reaches the
 * API until "Review & save", which shows the diff and warnings and then
 * replaces the role's permissions in one versioned call. The API enforces
 * the version, system-role, in-use and lock-out rules; the UI explains them.
 */
export function RolesWorkspace({
  roles,
  catalog,
  users,
  usersPartial,
}: {
  roles: readonly RoleListItem[];
  catalog: readonly Permission[];
  users: readonly User[];
  usersPartial: boolean;
}) {
  const canWrite = usePermission("settings.role.write");
  const myUserId = useAuthStore((s) => s.user?.userId ?? null);
  const { toast } = useToast();
  const sections = useMemo<AccessSection[]>(
    () => buildAccessModel(catalog),
    [catalog],
  );

  const [selectedId, setSelectedId] = useState<number | null>(
    roles[0]?.id ?? null,
  );
  const [tab, setTab] = useState<EditorTab>("permissions");
  const [draft, setDraft] = useState<Set<number> | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [dialog, setDialog] = useState<"create" | "edit" | "clone" | null>(
    null,
  );
  const [pendingSwitch, setPendingSwitch] = useState<RoleListItem | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;
  const detail = useRole(selected?.id);
  const createRole = useCreateRole();
  const cloneRole = useCloneRole();
  const updateRole = useUpdateRole();
  const savePermissions = useSetRolePermissions();

  const baseline = useMemo(
    () => new Set((detail.data?.permissions ?? []).map((p) => p.id)),
    [detail.data],
  );
  const current = draft ?? baseline;
  const changes = useMemo(
    () => diffGrants(sections, baseline, current),
    [sections, baseline, current],
  );
  const dirty = changes.length > 0;

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const members = useMemo(
    () =>
      selected
        ? users.filter((u) => u.roles.some((r) => r.id === selected.id))
        : [],
    [users, selected],
  );

  const hasTeamScope = useMemo(
    () =>
      sections.some((s) =>
        s.resources.some((r) =>
          r.actions.some((a) => levelOf(a, current) === "team"),
        ),
      ),
    [sections, current],
  );

  function select(role: RoleListItem) {
    if (role.id === selected?.id) return;
    if (dirty) {
      setPendingSwitch(role);
      return;
    }
    setSelectedId(role.id);
    setDraft(null);
  }

  function edit(next: Set<number>) {
    setDraft(sameSet(next, baseline) ? null : next);
  }

  // ---- review warnings ------------------------------------------------------
  const warnings = useMemo<ReviewWarning[]>(() => {
    if (!selected) return [];
    const out: ReviewWarning[] = [];
    const roleWrite = sections
      .flatMap((s) => s.resources.flatMap((r) => r.actions))
      .find((a) => a.code === "settings.role.write");
    const iHaveThisRole = members.some((m) => m.id === myUserId);
    if (
      roleWrite &&
      iHaveThisRole &&
      levelOf(roleWrite, baseline) !== "none" &&
      levelOf(roleWrite, current) === "none"
    ) {
      out.push({
        id: "lockout",
        blocking: true,
        text: "You hold this role and are removing “Manage roles”. The system refuses this if no other role of yours grants it.",
      });
    }
    const sensitive = changes.filter(
      (c) => c.action.sensitive && c.to !== "none",
    );
    if (sensitive.length > 0) {
      out.push({
        id: "sensitive",
        blocking: true,
        text: `Grants sensitive access: ${sensitive.map((c) => `${c.resourceLabel} · ${c.action.label}`).join(", ")}.`,
      });
    }
    const before = new Set(dutyConflicts(sections, baseline));
    for (const conflict of dutyConflicts(sections, current)) {
      if (!before.has(conflict)) {
        out.push({
          id: `sod-${conflict}`,
          blocking: false,
          text: `Separation of duties: this role now ${conflict.toLowerCase()}. The system still stops one person approving their own submission in some flows, but a separate approver role is safer.`,
        });
      }
    }
    if (selected.isSystem && changes.some((c) => c.to === "none")) {
      out.push({
        id: "system",
        blocking: true,
        text: `“${selected.name}” is a system role; users and defaults across the product expect what it grants.`,
      });
    }
    return out;
  }, [selected, sections, members, myUserId, baseline, current, changes]);

  async function save() {
    if (!selected || !detail.data) return;
    try {
      await savePermissions.mutateAsync({
        id: selected.id,
        input: { permissionIds: [...current], version: detail.data.version },
      });
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === "VERSION_CONFLICT") {
        await detail.refetch();
      }
      throw saveError(error);
    }
    setDraft(null);
    setReviewing(false);
    toast({ title: `Saved “${selected.name}”`, variant: "success" });
  }

  const createDialog = (
    <Dialog open onClose={() => setDialog(null)} title="Create role">
      <RoleForm
        submitLabel="Create role"
        onCancel={() => setDialog(null)}
        onSubmit={async (v) => {
          const created = await createRole.mutateAsync({
            name: v.name,
            ...(v.description ? { description: v.description } : {}),
          });
          setSelectedId(created.id);
          setDraft(null);
          setDialog(null);
          toast({
            title: `Role “${created.name}” created — choose its permissions`,
            variant: "success",
          });
        }}
      />
    </Dialog>
  );

  if (!selected) {
    return (
      <Card>
        <EmptyState
          title="No roles yet"
          description="Create a role, then choose what it can see and do."
          action={
            canWrite ? (
              <Button onClick={() => setDialog("create")}>Create role</Button>
            ) : undefined
          }
        />
        {dialog === "create" ? createDialog : null}
      </Card>
    );
  }

  const readOnly = !canWrite;
  const editorTabs = [
    { id: "permissions" as const, label: "Permissions" },
    { id: "navigation" as const, label: "Navigation" },
    { id: "members" as const, label: `Members (${selected.userCount})` },
    { id: "history" as const, label: "History" },
  ];
  const lastChangedBy = detail.data?.lastChangedBy?.fullName;

  return (
    <div className="flex flex-col gap-5">
      <RoleList
        roles={roles}
        selectedId={selected.id}
        canWrite={canWrite}
        onSelect={select}
        onCreate={() => setDialog("create")}
      />

      <section
        aria-label={`Role ${selected.name}`}
        className="flex min-w-0 flex-col gap-4"
      >
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-theme-lg font-bold text-gray-900 dark:text-white">
                  {selected.name}
                </h2>
                {selected.isSystem ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-theme-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    System role
                  </span>
                ) : null}
                <StatusBadge
                  label={selected.isActive ? "Active" : "Inactive"}
                  colorToken={selected.isActive ? "success" : "gray"}
                />
              </div>
              {selected.description ? (
                <p className="mt-1 text-theme-sm text-gray-700 dark:text-gray-300">
                  {selected.description}
                </p>
              ) : null}
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {selected.permissionCount} permissions · {selected.userCount}{" "}
                user{selected.userCount === 1 ? "" : "s"} · last changed{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                }).format(new Date(selected.updatedAt))}
                {lastChangedBy ? ` by ${lastChangedBy}` : ""}
                {selected.isSystem
                  ? " · permissions editable; name and status fixed"
                  : ""}
              </p>
            </div>
            {canWrite ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialog("clone")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Clone
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialog("edit")}
                  disabled={!detail.data}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit details
                </Button>
              </div>
            ) : null}
          </div>
          {!canWrite ? (
            <p className="mt-3 text-theme-xs text-gray-500">
              Read-only: changing roles needs “Manage roles”.
            </p>
          ) : null}
        </Card>

        {!selected.isActive ? (
          <Alert variant="warning" title="This role is inactive">
            An inactive role grants nothing. Reactivate it from “Edit details”.
          </Alert>
        ) : null}

        {detail.isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : detail.isError ? (
          <ErrorState onRetry={() => void detail.refetch()} />
        ) : (
          <Tabs
            label="Role sections"
            idPrefix="role-editor"
            tabs={editorTabs}
            value={tab}
            onChange={setTab}
          >
            {tab === "permissions" ? (
              <PermissionMatrix
                sections={sections}
                draft={current}
                baseline={baseline}
                onChange={edit}
                readOnly={readOnly}
              />
            ) : null}
            {tab === "navigation" ? (
              <RoleNavigationPanel
                sections={sections}
                draft={current}
                onChange={edit}
                readOnly={readOnly}
              />
            ) : null}
            {tab === "members" ? (
              <RoleMembersPanel
                roleName={selected.name}
                members={members}
                partial={usersPartial}
                hasTeamScope={hasTeamScope}
              />
            ) : null}
            {tab === "history" ? (
              <RoleHistoryPanel roleId={selected.id} catalog={catalog} />
            ) : null}
          </Tabs>
        )}

        {dirty ? (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-xl border border-warning-300 bg-white p-3 shadow-theme-lg sm:flex-row sm:items-center sm:justify-between dark:border-warning-800 dark:bg-gray-900"
          >
            <span className="text-theme-sm text-gray-800 dark:text-gray-200">
              <span className="font-semibold">{changes.length}</span> unsaved
              change{changes.length === 1 ? "" : "s"} to {selected.name}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setReviewing(true)}
              >
                Review &amp; save
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {reviewing ? (
        <ReviewChangesDialog
          roleName={selected.name}
          changes={changes}
          affectedUsers={selected.userCount}
          warnings={warnings}
          saving={savePermissions.isPending}
          onConfirm={save}
          onClose={() => setReviewing(false)}
        />
      ) : null}

      {pendingSwitch ? (
        <Dialog
          open
          onClose={() => setPendingSwitch(null)}
          title="Discard unsaved changes?"
          size="sm"
        >
          <p className="text-theme-sm text-gray-700 dark:text-gray-300">
            You have {changes.length} unsaved change
            {changes.length === 1 ? "" : "s"} to {selected.name}.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingSwitch(null)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSelectedId(pendingSwitch.id);
                setDraft(null);
                setPendingSwitch(null);
              }}
            >
              Discard and switch
            </Button>
          </div>
        </Dialog>
      ) : null}

      {dialog === "create" ? createDialog : null}
      {dialog === "clone" ? (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={`Clone role — ${selected.name}`}
        >
          <p className="mb-3 text-theme-xs text-gray-500 dark:text-gray-400">
            The copy gets the same {selected.permissionCount} permissions, no
            members, and is never a system role.
          </p>
          <RoleForm
            submitLabel="Create copy"
            initialValues={{
              name: `${selected.name} (copy)`,
              description: selected.description,
            }}
            createMode
            onCancel={() => setDialog(null)}
            onSubmit={async (v) => {
              const copy = await cloneRole.mutateAsync({
                id: selected.id,
                name: v.name,
                ...(v.description ? { description: v.description } : {}),
              });
              setSelectedId(copy.id);
              setDraft(null);
              setDialog(null);
              toast({ title: `Created “${copy.name}”`, variant: "success" });
            }}
          />
        </Dialog>
      ) : null}
      {dialog === "edit" && detail.data ? (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={`Edit role — ${selected.name}`}
        >
          <RoleForm
            key={`${selected.id}-${detail.data.version}`}
            submitLabel="Save"
            system={selected.isSystem}
            initialValues={{
              name: selected.name,
              description: selected.description,
              isActive: selected.isActive,
            }}
            onCancel={() => setDialog(null)}
            onSubmit={async (v) => {
              try {
                await updateRole.mutateAsync({
                  id: selected.id,
                  input: {
                    ...(selected.isSystem ? {} : { name: v.name }),
                    description: v.description || null,
                    ...(selected.isSystem
                      ? {}
                      : { isActive: v.isActive ?? true }),
                    version: detail.data!.version,
                  },
                });
              } catch (error) {
                if (
                  error instanceof ApiError &&
                  error.errorCode === "VERSION_CONFLICT"
                ) {
                  void detail.refetch();
                }
                throw error;
              }
              setDialog(null);
              toast({ title: "Role updated", variant: "success" });
            }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
