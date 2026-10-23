"use client";

import { useMemo, useState } from "react";
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
import { useEmployees } from "@/features/hr/employees/hooks";
import { useCreateTicket } from "../hooks";
import {
  createTicketSchema,
  EMPTY_CREATE_TICKET_FORM,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from "../schema";
import { TICKET_CATEGORIES } from "../types";

export interface RaiseTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
  defaultEmployeeId?: number | undefined;
  defaultEmployeeCode?: string | undefined;
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

/**
 * Modern modal for raising an employee support ticket or issuing a notice/warning.
 * Matches Reference 5 layout:
 * - Category and Target Employee dropdowns
 * - Clean Nunito Sans typography (zero font-mono)
 * - Live character counters
 */
export function RaiseTicketDialog({
  open,
  onClose,
  onSuccess,
  defaultEmployeeId,
}: RaiseTicketDialogProps) {
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeOptions = useMemo(
    () => employeesQuery.data?.data ?? [],
    [employeesQuery.data?.data],
  );

  const [values, setValues] = useState({
    ...EMPTY_CREATE_TICKET_FORM,
    employeeId: defaultEmployeeId ?? 0,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateTicket();
  const { toast } = useToast();
  const submitting = create.isPending;

  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = createTicketSchema.safeParse({
      employeeId: Number(values.employeeId),
      category: values.category,
      subject: values.subject,
      description: values.description,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setServerError(null);

    try {
      await create.mutateAsync(result.data);
      toast({ title: "Ticket created successfully", variant: "success" });
      setValues(EMPTY_CREATE_TICKET_FORM);
      onSuccess?.();
      onClose();
    } catch (err) {
      setServerError(describeCreateError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Ticket for Employee"
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4.5"
        noValidate
      >
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Submit a support ticket, inquiry, or administrative notice for an
            employee.
          </p>
        </div>

        {serverError ? (
          <Alert variant="error" title="Could not create ticket">
            {serverError}
          </Alert>
        ) : null}

        {/* 2-Column Row: Category & Target Employee (Reference 5 Layout) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category */}
          <FormField label="Category" required error={fieldErrors.category}>
            {(f) => (
              <Select
                {...f}
                invalid={f.invalid}
                aria-label="Ticket Category"
                value={values.category}
                disabled={submitting}
                onChange={(e) =>
                  update(
                    "category",
                    e.target.value as (typeof TICKET_CATEGORIES)[number],
                  )
                }
              >
                <option value="">Select category...</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {/* Target Employee */}
          <FormField
            label="Target Employee"
            required
            error={fieldErrors.employeeId}
          >
            {(f) => (
              <Select
                {...f}
                invalid={f.invalid}
                aria-label="Target Employee"
                value={values.employeeId ? String(values.employeeId) : ""}
                disabled={submitting}
                onChange={(e) => update("employeeId", Number(e.target.value))}
              >
                <option value="">Select employee...</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.fullName} ·{" "}
                    {emp.designation?.name ||
                      emp.team?.name ||
                      emp.employeeCode}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {/* Subject */}
        <FormField label="Subject" required error={fieldErrors.subject}>
          {(f) => (
            <div>
              <Input
                {...f}
                invalid={f.invalid}
                placeholder="Brief subject of the ticket"
                value={values.subject}
                disabled={submitting}
                maxLength={TICKET_SUBJECT_MAX}
                onChange={(e) => update("subject", e.target.value)}
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                {values.subject.length}/{TICKET_SUBJECT_MAX} characters
              </span>
            </div>
          )}
        </FormField>

        {/* Description / Message */}
        <FormField
          label="Description / Message"
          required
          error={fieldErrors.description}
        >
          {(f) => (
            <div>
              <Textarea
                {...f}
                invalid={f.invalid}
                placeholder="Write your message or notice to the employee..."
                value={values.description}
                disabled={submitting}
                rows={4}
                maxLength={TICKET_DESCRIPTION_MAX}
                onChange={(e) => update("description", e.target.value)}
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                {values.description.length}/{TICKET_DESCRIPTION_MAX} characters
              </span>
            </div>
          )}
        </FormField>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
