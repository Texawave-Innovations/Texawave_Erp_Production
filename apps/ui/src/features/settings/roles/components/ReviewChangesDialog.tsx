"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import { Alert, Button, Checkbox, Dialog } from "@texawave-erp/ui-kit";
import { levelLabel, type GrantChange } from "../utils/access-model";

export interface ReviewWarning {
  id: string;
  /** Blocking warnings need an explicit acknowledgement before saving. */
  blocking: boolean;
  text: string;
}

function describeSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError)
      return "You don't have permission to change roles.";
    if (error.statusCode === 404) return "This role no longer exists.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Saving failed. Try again.";
}

/**
 * The last step before a role's permissions are replaced: every change as
 * from → to, who is affected, and warnings. Saving calls `onConfirm`, which
 * re-reads the role first and refuses if someone else changed it meanwhile.
 */
export function ReviewChangesDialog({
  roleName,
  changes,
  affectedUsers,
  warnings,
  saving,
  onConfirm,
  onClose,
}: {
  roleName: string;
  changes: readonly GrantChange[];
  affectedUsers: number;
  warnings: readonly ReviewWarning[];
  saving: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsAck = warnings.some((w) => w.blocking);
  const added = changes.filter((c) => c.from === "none").length;
  const removed = changes.filter((c) => c.to === "none").length;
  const rescoped = changes.length - added - removed;

  async function confirm() {
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(describeSaveError(e));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Review changes — ${roleName}`}
      size="2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-success-700 dark:text-success-400">
            {added} granted
          </span>{" "}
          ·{" "}
          <span className="font-semibold text-error-700 dark:text-error-400">
            {removed} removed
          </span>{" "}
          · <span className="font-semibold">{rescoped} rescoped</span>. Affects{" "}
          <span className="font-semibold">
            {affectedUsers} user{affectedUsers === 1 ? "" : "s"}
          </span>{" "}
          with this role; it applies from their next request.
        </p>

        {warnings.length > 0 ? (
          <Alert variant="warning" title="Check before saving">
            <ul className="list-disc pl-4">
              {warnings.map((w) => (
                <li key={w.id}>{w.text}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-theme-xs">
            <caption className="sr-only">Permission changes</caption>
            <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-gray-900">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Permission
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {changes.map((c) => (
                <tr key={c.action.code}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                      {c.resourceLabel} · {c.action.label}
                      {c.action.sensitive ? (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-warning-600"
                          aria-label="Sensitive"
                        />
                      ) : null}
                    </span>
                    <span className="text-gray-400">{c.sectionLabel}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={
                        c.from === "none"
                          ? "text-gray-400"
                          : "text-gray-700 dark:text-gray-300"
                      }
                    >
                      {levelLabel(c.from)}
                    </span>
                    <ArrowRight
                      aria-label="to"
                      className="mx-1.5 inline h-3 w-3 text-gray-400"
                    />
                    <span
                      className={
                        c.to === "none"
                          ? "font-semibold text-error-700 dark:text-error-400"
                          : "font-semibold text-success-700 dark:text-success-400"
                      }
                    >
                      {levelLabel(c.to)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {needsAck ? (
          <label className="flex items-start gap-2 text-theme-sm text-gray-800 dark:text-gray-200">
            <Checkbox
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I understand the warnings above and want to save.
          </label>
        ) : null}

        {error ? (
          <Alert variant="error" title="Not saved">
            {error}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Keep editing
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={changes.length === 0 || (needsAck && !acknowledged)}
            onClick={() => void confirm()}
          >
            Save {changes.length} change{changes.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
