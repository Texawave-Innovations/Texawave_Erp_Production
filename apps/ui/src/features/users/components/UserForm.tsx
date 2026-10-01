"use client";

import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from "@texawave-erp/core";
import { Button, Checkbox, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface UserFormProps {
  initialValues?: Partial<CreateUserFormValues & { isActive?: boolean }>;
  isEdit?: boolean;
  onSubmit: (
    values: CreateUserFormValues | UpdateUserFormValues,
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function UserForm({
  initialValues,
  isEdit = false,
  onSubmit,
  onCancel,
  submitLabel,
}: UserFormProps) {
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isEdit) {
      const result = updateUserSchema.safeParse({
        email,
        fullName,
        isActive,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string") fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setSubmitError(null);
      setSubmitting(true);
      try {
        await onSubmit(result.data);
      } catch {
        setSubmitError("Could not update user. Check fields and try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      const result = createUserSchema.safeParse({
        email,
        fullName,
        password,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string") fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setSubmitError(null);
      setSubmitting(true);
      try {
        await onSubmit(result.data);
      } catch {
        setSubmitError("Could not create user. Check fields and try again.");
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Full Name" required error={errors.fullName}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Email" required error={errors.email}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {!isEdit && (
        <FormField label="Password" required error={errors.password}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      )}

      {isEdit && (
        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={isActive}
            onChange={() => setIsActive((prev) => !prev)}
            disabled={submitting}
          />
          <span>Active</span>
        </label>
      )}

      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
