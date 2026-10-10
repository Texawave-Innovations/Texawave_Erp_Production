"use client";

import { useState } from "react";
import type { Department } from "@texawave-erp/api-types";
import {
  createDepartmentSchema,
  type CreateDepartmentFormValues,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  FormField,
  Input,
} from "@texawave-erp/ui-kit";
import { getDepartmentCode } from "../utils";

export interface DepartmentDialogProps {
  open: boolean;
  onClose: () => void;
  department?: Department | null | undefined;
  onSubmit: (values: CreateDepartmentFormValues) => Promise<void>;
}

interface DepartmentDialogFormProps {
  department?: Department | null | undefined;
  onClose: () => void;
  onSubmit: (values: CreateDepartmentFormValues) => Promise<void>;
}

function DepartmentDialogForm({
  department,
  onClose,
  onSubmit,
}: DepartmentDialogFormProps) {
  const isEdit = Boolean(department);
  const [name, setName] = useState(department?.name ?? "");
  const [isActive, setIsActive] = useState(department?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const departmentCode = department
    ? getDepartmentCode(department.name, department.customFields)
    : "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const generatedCode = getDepartmentCode(name, department?.customFields);

    const result = createDepartmentSchema.safeParse({
      name,
      isActive,
      customFields: {
        ...(department?.customFields ?? {}),
        code: generatedCode,
      },
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not save department. Please verify the name and try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5" noValidate>
      <div>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {isEdit
            ? "View or update department information."
            : "Create a new department for your organization."}
        </p>
      </div>

      {/* Department Name */}
      <FormField label="Department Name" required error={errors.name}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            placeholder="Enter department name..."
            autoComplete="off"
            invalid={fieldProps.invalid}
            value={name}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </FormField>

      {/* Department Code (Only in Edit / View mode) */}
      {isEdit ? (
        <FormField
          label="Department Code"
          hint="Code is generated automatically and cannot be edited."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              readOnly
              disabled
              value={departmentCode}
              className="bg-gray-50 font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed"
            />
          )}
        </FormField>
      ) : null}

      {/* Active Checkbox */}
      <div className="pt-1">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={submitting}
            className="mt-0.5"
          />
          <div className="flex flex-col">
            <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              Active
            </span>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              {isEdit
                ? "Department is active and available for use."
                : "Department will be active after creation."}
            </span>
          </div>
        </label>
      </div>

      {submitError ? (
        <Alert variant="error" title="Could not save">
          {submitError}
        </Alert>
      ) : null}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
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
          loading={submitting}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium"
        >
          {isEdit ? "Update Department" : "Create Department"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Centered modal for creating or editing an organizational department.
 * Implements Screen 3 (New Department) and Screen 4 (Department Details).
 */
export function DepartmentDialog({
  open,
  onClose,
  department,
  onSubmit,
}: DepartmentDialogProps) {
  const isEdit = Boolean(department);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Department Details" : "New Department"}
      size="lg"
    >
      {open ? (
        <DepartmentDialogForm
          key={department?.id ?? "new"}
          department={department}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}
