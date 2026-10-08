"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useCreateMyTicket } from "../hooks";
import {
  createMyTicketSchema,
  EMPTY_CREATE_MY_TICKET_FORM,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from "../schema";
import { EMPLOYEE_TICKET_CATEGORIES } from "../types";

export interface CreateMyTicketDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to raise a ticket.";
    }
    if (error.errorCode === "CATEGORY_NOT_ALLOWED") {
      return "That category can only be raised by HR.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Raise a ticket to HR (legacy `RaiseTicket.tsx` "New Ticket"). The
 * requester is always the caller's own employee record — no employee field. */
export function CreateMyTicketDialog({
  open,
  onClose,
}: CreateMyTicketDialogProps) {
  const [values, setValues] = useState(EMPTY_CREATE_MY_TICKET_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateMyTicket();
  const { toast } = useToast();
  const submitting = create.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createMyTicketSchema.safeParse(values);
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
    try {
      await create.mutateAsync(result.data);
      toast({ title: "Ticket raised", variant: "success" });
      setValues(EMPTY_CREATE_MY_TICKET_FORM);
      onClose();
    } catch (error) {
      setServerError(describeCreateError(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Raise ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Category" required error={errors.category}>
          {(f) => (
            <Select
              {...f}
              invalid={f.invalid}
              value={values.category}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  category: e.target.value as typeof v.category,
                }))
              }
            >
              <option value="">Select a category</option>
              {EMPLOYEE_TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Subject"
          required
          error={errors.subject}
          hint={`Up to ${TICKET_SUBJECT_MAX} characters`}
        >
          {(f) => (
            <Input
              {...f}
              invalid={f.invalid}
              value={values.subject}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, subject: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField
          label="Description"
          required
          error={errors.description}
          hint={`Up to ${TICKET_DESCRIPTION_MAX} characters`}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={4}
              invalid={f.invalid}
              value={values.description}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
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
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Raise ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
