"use client";

import {
  Alert,
  Button,
  Checkbox,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useRoles } from "@/features/settings/roles/hooks";
import { useAssignUserRoles } from "../hooks";

export interface AssignRolesModalProps {
  userId: number;
  userName: string;
  currentRoleIds: number[];
  onClose: () => void;
}

export function AssignRolesModal({
  userId,
  userName,
  currentRoleIds,
  onClose,
}: AssignRolesModalProps) {
  const rolesQuery = useRoles({ limit: 100 });
  const assignMutation = useAssignUserRoles();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(currentRoleIds),
  );

  if (rolesQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (rolesQuery.isError) {
    return (
      <Alert variant="error" title="Could not load roles">
        Close this dialog and try again.
      </Alert>
    );
  }

  const roles = rolesQuery.data.data;

  function toggle(roleId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async function handleSave() {
    try {
      await assignMutation.mutateAsync({
        id: userId,
        input: { roleIds: [...selectedIds] },
      });
      toast({
        title: `Updated roles for "${userName}"`,
        variant: "success",
      });
      onClose();
    } catch {
      toast({ title: "Could not update roles", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {roles.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No roles configured yet.
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2.5 rounded-md p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <Checkbox
                checked={selectedIds.has(role.id)}
                onChange={() => toggle(role.id)}
                disabled={assignMutation.isPending}
              />
              <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
                {role.name}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={assignMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={assignMutation.isPending}
          onClick={() => void handleSave()}
        >
          Save roles
        </Button>
      </div>
    </div>
  );
}
