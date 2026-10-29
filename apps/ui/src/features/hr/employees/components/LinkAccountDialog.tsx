"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useUsers } from "@/features/users/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  useEmployee,
  useLinkEmployeeUser,
  useUnlinkEmployeeUser,
} from "../hooks";
import {
  linkAccountSchema,
  unlinkAccountSchema,
  type LinkAccountValues,
  type UnlinkAccountValues,
} from "../schema";
import type { EmployeeDetail } from "../types";
import { describeSaveError } from "./EmployeeForm";

export interface LinkAccountDialogProps {
  open: boolean;
  onClose: () => void;
  employee: Pick<EmployeeDetail, "id" | "fullName" | "employeeCode"> & {
    workEmail?: string | null;
    avatarUrl?: string | null;
  };
  /** "link" attaches an existing platform user; "unlink" detaches the current one. */
  mode: "link" | "unlink";
}

type FieldErrors = Partial<Record<"userId" | "reason", string>>;

/**
 * The API only accepts a numeric user id (dto/lifecycle.dto.ts). Rather than
 * have HR type or search for it, we look up the platform user whose e-mail
 * matches this employee's own work e-mail — in practice the login account is
 * always created with that same address — and link it automatically. The
 * caller's `employee` prop may come from a list row that omits work e-mail
 * (EmployeeListItem), so this always re-fetches the full detail record to
 * get a reliable e-mail regardless of entry point. Falls back to a plain
 * numeric field when there is no work e-mail on file, or when the caller
 * can't read /users (`users.user.read`) to resolve it.
 */
export function LinkAccountDialog({
  open,
  onClose,
  employee,
  mode,
}: LinkAccountDialogProps) {
  const [values, setValues] = useState({ userId: "", reason: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const linkMutation = useLinkEmployeeUser();
  const unlinkMutation = useUnlinkEmployeeUser();
  const { toast } = useToast();

  const employeeDetail = useEmployee(mode === "link" ? employee.id : 0);
  const canSearchUsers = usePermission("users.user.read");
  const workEmail =
    (employeeDetail.data?.workEmail ?? employee.workEmail)?.trim() ?? "";
  const canAutoMatch = canSearchUsers && mode === "link" && workEmail !== "";
  const resolvingEmail = mode === "link" && employeeDetail.isPending;
  const userMatches = useUsers(
    { page: 1, limit: 5, search: workEmail },
    canAutoMatch,
  );

  const matchedUser = (userMatches.data?.data ?? []).find(
    (u) => u.email.toLowerCase() === workEmail.toLowerCase(),
  );
  const effectiveUserId = canAutoMatch
    ? matchedUser
      ? String(matchedUser.id)
      : ""
    : values.userId;

  const mutation = mode === "link" ? linkMutation : unlinkMutation;
  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result =
      mode === "link"
        ? linkAccountSchema.safeParse({ ...values, userId: effectiveUserId })
        : unlinkAccountSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string")
          next[key as keyof FieldErrors] = issue.message;
      }
      setErrors(next);
      setServerError(null);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      if (mode === "link") {
        const data = result.data as LinkAccountValues;
        await linkMutation.mutateAsync({
          id: employee.id,
          body: {
            userId: Number(data.userId),
            ...(data.reason ? { reason: data.reason } : {}),
          },
        });
        toast({ title: "Login account linked", variant: "success" });
      } else {
        const data = result.data as UnlinkAccountValues;
        await unlinkMutation.mutateAsync({
          id: employee.id,
          body: data.reason ? { reason: data.reason } : {},
        });
        toast({ title: "Login account unlinked", variant: "success" });
      }
      onClose();
    } catch (error) {
      setServerError(describeSaveError(error).message);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "link" ? "Link login account" : "Unlink login account"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <EmployeeIdentity
            name={employee.fullName}
            code={employee.employeeCode}
            avatarUrl={employee.avatarUrl}
          />
        </div>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {mode === "link"
            ? "Attach an existing platform user to this employee. The user must be in this organization, active, and not already linked to another employee."
            : "Remove this employee's linked login. They will no longer be able to sign in as this employee."}
        </p>
        {mode === "link" && resolvingEmail ? (
          <FormField label="Platform user" error={errors.userId}>
            {() => (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Loading employee details…
              </p>
            )}
          </FormField>
        ) : null}
        {mode === "link" && !resolvingEmail && canAutoMatch ? (
          <FormField label="Platform user" error={errors.userId}>
            {() =>
              userMatches.isPending ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  Looking up {workEmail}…
                </p>
              ) : matchedUser ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-theme-sm dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="font-semibold text-[#0a3271] dark:text-sky-100">
                    {matchedUser.fullName}
                  </span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">
                    ({matchedUser.email})
                  </span>
                </div>
              ) : (
                <p className="text-theme-xs text-error-600 dark:text-error-400">
                  No platform account found for {workEmail}. Create one in
                  Settings → Users first, using this same e-mail.
                </p>
              )
            }
          </FormField>
        ) : null}
        {mode === "link" && !resolvingEmail && !canAutoMatch ? (
          <FormField
            label="User ID"
            required
            error={errors.userId}
            hint={
              workEmail === ""
                ? "This employee has no work e-mail on file, so the account can't be auto-matched — look up the numeric platform user ID in Settings → Users."
                : "Numeric platform user ID — look it up in Settings → Users first."
            }
          >
            {(f) => (
              <Input
                {...f}
                inputMode="numeric"
                invalid={f.invalid}
                value={values.userId}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, userId: e.target.value }))
                }
              />
            )}
          </FormField>
        ) : null}
        <FormField
          label="Reason"
          error={errors.reason}
          hint="Optional. 3–500 characters if given; kept in the audit trail."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.reason}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
            />
          )}
        </FormField>
        {serverError ? (
          <p
            role="alert"
            className="text-theme-xs text-error-600 dark:text-error-400"
          >
            {serverError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === "unlink" ? "destructive" : "primary"}
            loading={submitting}
            disabled={
              mode === "link" &&
              (resolvingEmail ||
                (canAutoMatch && (userMatches.isPending || !matchedUser)))
            }
          >
            {mode === "link" ? "Link account" : "Unlink account"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
