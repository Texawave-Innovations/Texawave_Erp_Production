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
import { useCreateTicket } from "../hooks";
import {
  createTicketSchema,
  EMPTY_CREATE_TICKET_FORM,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from "../schema";
import { TICKET_CATEGORIES } from "../types";

export interface TicketFormProps {
  onSubmitted: () => void;
  onCancel: () => void;
}

function describeCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "INVALID_EMPLOYEE") {
      return "That employee does not exist in your organization or is not in your scope.";
    }
    if (error.errorCode === "EMPLOYEE_HAS_LEFT") {
      return "Cannot raise a ticket for an employee who has left.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to raise a ticket.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Raise a ticket for an employee (HR/admin write). Does not reset entered
 * values on a failed submit (Docs/DESIGN_SYSTEM.md). */
export function TicketForm({ onSubmitted, onCancel }: TicketFormProps) {
  const [values, setValues] = useState({
    ...EMPTY_CREATE_TICKET_FORM,
    employeeId: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateTicket();
  const submitting = create.isPending;

  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const employeeId = Number(values.employeeId);
    const result = createTicketSchema.safeParse({
      employeeId,
      category: values.category,
      subject: values.subject,
      description: values.description,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key])
          errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    try {
      await create.mutateAsync(result.data);
      onSubmitted();
    } catch (err) {
      setServerError(describeCreateError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="Employee ID" error={fieldErrors.employeeId}>
        {(f) => (
          <Input
            {...f}
            type="number"
            min="1"
            invalid={f.invalid}
            value={values.employeeId}
            disabled={submitting}
            onChange={(e) => update("employeeId", e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Category" error={fieldErrors.category}>
        {(f) => (
          <Select
            {...f}
            invalid={f.invalid}
            value={values.category}
            disabled={submitting}
            onChange={(e) =>
              update("category", e.target.value as typeof values.category)
            }
          >
            <option value="">Select a category</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        label="Subject"
        error={fieldErrors.subject}
        hint={`Up to ${TICKET_SUBJECT_MAX} characters`}
      >
        {(f) => (
          <Input
            {...f}
            invalid={f.invalid}
            value={values.subject}
            disabled={submitting}
            onChange={(e) => update("subject", e.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Description"
        error={fieldErrors.description}
        hint={`Up to ${TICKET_DESCRIPTION_MAX} characters`}
      >
        {(f) => (
          <Textarea
            {...f}
            rows={4}
            invalid={f.invalid}
            value={values.description}
            disabled={submitting}
            onChange={(e) => update("description", e.target.value)}
          />
        )}
      </FormField>
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
          Raise ticket
        </Button>
      </div>
    </form>
  );
}
