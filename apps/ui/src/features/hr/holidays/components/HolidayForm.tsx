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
}

export interface HolidayFormProps {
  /** Date and location are immutable after creation, so the edit form hides them. */
  mode: "create" | "edit";
  initialValues?: Partial<CreateHolidayValues>;
  onSubmit: (values: HolidayFormSubmitValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to save this holiday.";
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
  onSubmit,
  onCancel,
  submitLabel,
}: HolidayFormProps) {
  const [values, setValues] = useState<CreateHolidayValues>({
    ...EMPTY_CREATE_FORM,
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
      });
    } catch (error) {
      setServerError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {mode === "create" ? (
        <FormField label="Date" required error={errors.holidayDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.holidayDate}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, holidayDate: e.target.value }))
              }
            />
          )}
        </FormField>
      ) : null}

      <FormField label="Holiday name" required error={errors.name}>
        {(f) => (
          <Input
            {...f}
            invalid={f.invalid}
            value={values.name}
            disabled={submitting}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        )}
      </FormField>

      <FormField
        label="Description"
        error={errors.description}
        hint="Up to 500 characters. Optional."
      >
        {(f) => (
          <Textarea
            {...f}
            rows={3}
            invalid={f.invalid}
            value={values.description}
            disabled={submitting}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
          />
        )}
      </FormField>

      {mode === "create" ? (
        <FormField
          label="Applies to"
          error={errors.workLocationId}
          hint="Leave as Whole organization, or restrict to a single work location. Cannot be changed later."
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
      ) : null}

      {serverError ? (
        <Alert variant="error" title="Could not save">
          {serverError}
        </Alert>
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
