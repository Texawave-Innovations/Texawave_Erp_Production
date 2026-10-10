"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useWorkLocations } from "../hooks";
import {
  createHolidaySchema,
  EMPTY_CREATE_FORM,
  updateHolidaySchema,
  type CreateHolidayValues,
} from "../schema";

export interface HolidayFormSubmitValues {
  holidayDate: string;
  name: string;
  description?: string | undefined;
  workLocationId?: number | undefined;
  isActive?: boolean | undefined;
}

export interface HolidayFormProps {
  /** Date and location are immutable after creation, but displayed for clarity. */
  mode: "create" | "edit";
  initialValues?: Partial<
    CreateHolidayValues & { isActive?: "true" | "false" }
  >;
  initialWorkLocationName?: string;
  onSubmit: (values: HolidayFormSubmitValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to save this holiday.";
    }
    if (error.errorCode === "HOLIDAY_DATE_TAKEN") {
      return "A holiday on this date already exists for this scope.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Could not save this holiday. Check the fields above and try again.";
}

export function HolidayForm({
  mode,
  initialValues,
  initialWorkLocationName,
  onSubmit,
  onCancel,
  submitLabel,
}: HolidayFormProps) {
  const [values, setValues] = useState<
    CreateHolidayValues & { isActive?: "true" | "false" }
  >({
    ...EMPTY_CREATE_FORM,
    isActive: "true",
    ...initialValues,
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const workLocations = useWorkLocations(mode === "create");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const schema =
      mode === "create" ? createHolidaySchema : updateHolidaySchema;
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        holidayDate: values.holidayDate,
        name: values.name,
        description: values.description || undefined,
        ...(mode === "create" && values.workLocationId
          ? { workLocationId: Number(values.workLocationId) }
          : {}),
        ...(mode === "edit" && values.isActive !== undefined
          ? { isActive: values.isActive === "true" }
          : {}),
      });
    } catch (error) {
      setServerError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Date Field */}
      {mode === "create" ? (
        <FormField label="Date" required error={errors.holidayDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              aria-label="Date"
              invalid={f.invalid}
              value={values.holidayDate}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, holidayDate: e.target.value }))
              }
            />
          )}
        </FormField>
      ) : (
        <FormField label="Date" hint="Date cannot be modified once created.">
          {(f) => (
            <Input
              {...f}
              type="date"
              aria-label="Date"
              disabled
              value={values.holidayDate}
            />
          )}
        </FormField>
      )}

      {/* Holiday Name */}
      <FormField label="Holiday name" required error={errors.name}>
        {(f) => (
          <Input
            {...f}
            aria-label="Holiday name"
            invalid={f.invalid}
            placeholder="e.g. Republic Day"
            value={values.name}
            disabled={submitting}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        )}
      </FormField>

      {/* Description */}
      <FormField
        label="Description (Optional)"
        error={errors.description}
        hint="Optional. Up to 500 characters."
        labelAction={
          <span className="font-mono text-theme-xs text-gray-400 dark:text-gray-500">
            {values.description?.length ?? 0}/500
          </span>
        }
      >
        {(f) => (
          <Textarea
            {...f}
            rows={3}
            placeholder="Enter description..."
            invalid={f.invalid}
            value={values.description}
            disabled={submitting}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
          />
        )}
      </FormField>

      {/* Applies To */}
      {mode === "create" ? (
        <FormField
          label="Applies to"
          error={errors.workLocationId}
          hint="Leave as Whole organization, or select a specific work location."
        >
          {(f) => (
            <Select
              {...f}
              aria-label="Applies to"
              value={values.workLocationId}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, workLocationId: e.target.value }))
              }
            >
              <option value="">Whole organization</option>
              {(workLocations.data ?? []).map((loc) => (
                <option key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : (
        <FormField
          label="Applies to"
          hint="Location scope cannot be modified once created."
        >
          {(f) => (
            <Input
              {...f}
              aria-label="Applies to"
              disabled
              value={initialWorkLocationName ?? "Whole organization"}
            />
          )}
        </FormField>
      )}

      {/* Status (Edit mode only) */}
      {mode === "edit" ? (
        <FormField
          label="Status"
          hint="Active holidays take effect as non-working days in attendance."
        >
          {(f) => (
            <Select
              {...f}
              aria-label="Status"
              value={values.isActive ?? "true"}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  isActive: e.target.value as "true" | "false",
                }))
              }
            >
              <option value="true">Active</option>
              <option value="false">Deactivated</option>
            </Select>
          )}
        </FormField>
      ) : null}

      {serverError ? (
        <Alert variant="error" title="Could not save">
          {serverError}
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
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
