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
import { useCreateMyExpenseClaim } from "../hooks";
import { EMPTY_SUBMIT_FORM, submitExpenseClaimSchema } from "../schema";
import { EXPENSE_TYPES } from "../types";

export interface SubmitExpenseClaimDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to submit an expense claim.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the amount, date and description and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Submits an expense claim for the authenticated user's own employee. There
 * is deliberately no employee picker (no `employeeId` in the self-service
 * create DTO) and no receipt file upload (legacy has none — `receiptRef` is
 * free text only). */
export function SubmitExpenseClaimDialog({
  open,
  onClose,
}: SubmitExpenseClaimDialogProps) {
  const [values, setValues] = useState(EMPTY_SUBMIT_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCreateMyExpenseClaim();
  const { toast } = useToast();

  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = submitExpenseClaimSchema.safeParse(values);
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
      await mutation.mutateAsync({
        expenseType: result.data.expenseType,
        amount: result.data.amount,
        expenseDate: result.data.expenseDate,
        description: result.data.description,
        ...(result.data.receiptRef
          ? { receiptRef: result.data.receiptRef }
          : {}),
      });
      toast({ title: "Expense claim submitted", variant: "success" });
      setValues(EMPTY_SUBMIT_FORM);
      onClose();
    } catch (err) {
      setServerError(describeSubmitError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Submit expense claim">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Expense type" required error={errors.expenseType}>
          {(f) => (
            <Select
              {...f}
              value={values.expenseType}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  expenseType: e.target.value as typeof v.expenseType,
                }))
              }
            >
              <option value="">Select a type</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Amount" required error={errors.amount}>
            {(f) => (
              <Input
                {...f}
                type="number"
                step="0.01"
                min="0.01"
                invalid={f.invalid}
                value={values.amount || ""}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, amount: Number(e.target.value) }))
                }
              />
            )}
          </FormField>
          <FormField label="Expense date" required error={errors.expenseDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.expenseDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, expenseDate: e.target.value }))
                }
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Description"
          required
          error={errors.description}
          hint="1–300 characters."
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
        <FormField
          label="Receipt reference"
          error={errors.receiptRef}
          hint="Optional. Free text, up to 100 characters — no file upload."
        >
          {(f) => (
            <Input
              {...f}
              invalid={f.invalid}
              value={values.receiptRef}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, receiptRef: e.target.value }))
              }
            />
          )}
        </FormField>
        {serverError ? (
          <Alert variant="error" title="Could not submit">
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
            Submit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
