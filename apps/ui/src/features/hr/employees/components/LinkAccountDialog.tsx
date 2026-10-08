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
import { useLinkEmployeeUser, useUnlinkEmployeeUser } from "../hooks";
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
  employee: Pick<EmployeeDetail, "id" | "fullName">;
  /** "link" attaches an existing platform user; "unlink" detaches the current one. */
  mode: "link" | "unlink";
}

type FieldErrors = Partial<Record<"userId" | "reason", string>>;

/**
 * The API only accepts a numeric user id (dto/lifecycle.dto.ts) — there is no
 * user-search endpoint this role can reach from here (`/users` requires
 * `users.user.read`, which is not granted to HR Manager by default), so the
 * id is typed in directly, same as the Team ID field in EmployeeForm.
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

  const mutation = mode === "link" ? linkMutation : unlinkMutation;
  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result =
      mode === "link"
        ? linkAccountSchema.safeParse(values)
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
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {mode === "link"
            ? `Attach an existing platform user to ${employee.fullName}. The user must be in this organization, active, and not already linked to another employee.`
            : `Remove ${employee.fullName}'s linked login. They will no longer be able to sign in as this employee.`}
        </p>
        {mode === "link" ? (
          <FormField
            label="User ID"
            required
            error={errors.userId}
            hint="Numeric platform user ID — look it up in Settings → Users first."
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
          >
            {mode === "link" ? "Link account" : "Unlink account"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
