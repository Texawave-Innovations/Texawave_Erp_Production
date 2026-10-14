"use client";

import {
  ApiError,
  createRoleSchema,
  type CreateRoleFormValues,
} from "@texawave-erp/core";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface RoleFormValues extends CreateRoleFormValues {
  description: string;
  isActive?: boolean;
}

export interface RoleFormProps {
  initialValues?: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  };
  /** A system role: its name and status are fixed by the API. */
  system?: boolean;
  /** Prefilled but creating a new role (clone): no status checkbox. */
  createMode?: boolean;
  onSubmit: (values: RoleFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

const MESSAGES: Record<string, string> = {
  SYSTEM_ROLE_PROTECTED:
    "System roles keep their name and stay active. Clone the role to make a variant.",
  ROLE_IN_USE:
    "Users still hold this role. Move them to another role before deactivating it.",
  VERSION_CONFLICT:
    "Someone else changed this role meanwhile. Close this dialog to load their version, then try again.",
  ACCESS_LOCKOUT: "This would leave nobody — or you — able to manage roles.",
};

/**
 * Create / edit a role's name, description and status. Validates the name
 * with the same zod schema the API mirrors (`createRoleSchema`,
 * packages/core). Entered values are kept on a failed submit
 * (Docs/DESIGN_SYSTEM.md "Preserve entered form values when submission
 * fails").
 */
export function RoleForm({
  initialValues,
  system = false,
  createMode = false,
  onSubmit,
  onCancel,
  submitLabel,
}: RoleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const editing = Boolean(initialValues) && !createMode;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createRoleSchema.safeParse({ name });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") nextErrors[key] = issue.message;
      }
    }
    if (description.trim().length > 500) {
      nextErrors.description = "Keep the description under 500 characters.";
    }
    setErrors(nextErrors);
    if (!result.success || Object.keys(nextErrors).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        ...result.data,
        description: description.trim(),
        ...(editing ? { isActive } : {}),
      });
    } catch (err) {
      setSubmitError(
        ApiError.isApiError(err)
          ? (MESSAGES[err.errorCode ?? ""] ?? err.message)
          : err instanceof Error
            ? err.message
            : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        label="Role name"
        required
        error={errors.name}
        hint={system ? "System roles keep their name." : undefined}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={name}
            placeholder="e.g. Payroll Officer"
            onChange={(e) => setName(e.target.value)}
            disabled={submitting || system}
          />
        )}
      </FormField>

      <FormField label="Description" error={errors.description}>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            invalid={fieldProps.invalid}
            rows={2}
            value={description}
            placeholder="Who this role is for"
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {editing ? (
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={submitting || system}
          />
          <div className="flex flex-col">
            <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
              Active role
            </span>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              {system
                ? "System roles always stay active."
                : "An inactive role grants nothing. It can only be deactivated once nobody holds it."}
            </span>
          </div>
        </label>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
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
