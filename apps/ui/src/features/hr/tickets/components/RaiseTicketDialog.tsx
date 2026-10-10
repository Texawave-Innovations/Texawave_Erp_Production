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
import { User } from "lucide-react";
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
 * Centered modal for raising an employee support ticket.
 * Displays live character counters, pre-populated Employee ID, category dropdown,
 * and handles submission with validation feedback.
 */
export function RaiseTicketDialog({
  open,
  onClose,
  onSuccess,
  defaultEmployeeId,
  defaultEmployeeCode,
}: RaiseTicketDialogProps) {
  const employeesQuery = useEmployees({ page: 1, limit: 1 });
  const firstEmployee = employeesQuery.data?.data?.[0];

  const [values, setValues] = useState({
    ...EMPTY_CREATE_TICKET_FORM,
    employeeId:
      defaultEmployeeCode ??
      (defaultEmployeeId ? String(defaultEmployeeId) : ""),
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateTicket();
  const { toast } = useToast();
  const submitting = create.isPending;

  const fallbackEmployeeCode =
    firstEmployee?.employeeCode ||
    (firstEmployee?.id ? String(firstEmployee.id) : "");
  const currentEmployeeId = values.employeeId || fallbackEmployeeCode;

  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Parse employee ID: strip "EMP-" or non-digits if present, or fallback to numeric ID
    const rawEmp = String(currentEmployeeId).trim();
    let parsedEmployeeId = 0;
    if (rawEmp.toUpperCase().startsWith("EMP-")) {
      parsedEmployeeId = parseInt(rawEmp.replace(/^EMP-/i, ""), 10);
    } else {
      parsedEmployeeId = parseInt(rawEmp, 10);
    }

    if (isNaN(parsedEmployeeId) || parsedEmployeeId <= 0) {
      // If employeeCode was matched against firstEmployee, use its numeric ID
      if (firstEmployee && rawEmp === firstEmployee.employeeCode) {
        parsedEmployeeId = firstEmployee.id;
      } else if (defaultEmployeeId) {
        parsedEmployeeId = defaultEmployeeId;
      }
    }

    const result = createTicketSchema.safeParse({
      employeeId: parsedEmployeeId,
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
      toast({ title: "Ticket raised successfully", variant: "success" });
      setValues({
        ...EMPTY_CREATE_TICKET_FORM,
        employeeId: firstEmployee?.employeeCode ?? "EMP-0001",
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setServerError(describeCreateError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Raise Ticket" size="lg">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4.5"
        noValidate
      >
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Submit a new support ticket.
          </p>
        </div>

        {/* Employee ID */}
        <FormField label="Employee ID" required error={fieldErrors.employeeId}>
          {(f) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <User className="h-4 w-4" />
              </span>
              <Input
                {...f}
                invalid={f.invalid}
                placeholder="EMP-0001"
                value={currentEmployeeId}
                disabled={submitting}
                className="pl-9.5 font-mono"
                onChange={(e) => update("employeeId", e.target.value)}
              />
            </div>
          )}
        </FormField>

        {/* Category */}
        <FormField label="Category" required error={fieldErrors.category}>
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
              <option value="">Select category</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Subject */}
        <FormField
          label="Subject"
          required
          error={fieldErrors.subject}
          labelAction={
            <span className="text-theme-xs text-gray-400 font-normal">
              {values.subject.length} / {TICKET_SUBJECT_MAX}
            </span>
          }
        >
          {(f) => (
            <Input
              {...f}
              invalid={f.invalid}
              placeholder="Enter ticket subject..."
              maxLength={TICKET_SUBJECT_MAX}
              value={values.subject}
              disabled={submitting}
              onChange={(e) => update("subject", e.target.value)}
            />
          )}
        </FormField>

        {/* Description */}
        <FormField
          label="Description"
          required
          error={fieldErrors.description}
          labelAction={
            <span className="text-theme-xs text-gray-400 font-normal">
              {values.description.length} / {TICKET_DESCRIPTION_MAX}
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={4}
              invalid={f.invalid}
              placeholder="Enter detailed description of your request..."
              maxLength={TICKET_DESCRIPTION_MAX}
              value={values.description}
              disabled={submitting}
              onChange={(e) => update("description", e.target.value)}
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit ticket">
            {serverError}
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
            Raise Ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
