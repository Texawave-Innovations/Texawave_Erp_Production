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

const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * Submits an expense claim for the authenticated user's own employee.
 */
export function SubmitExpenseClaimDialog({
  open,
  onClose,
}: SubmitExpenseClaimDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_SUBMIT_FORM,
    expenseDate: todayStr(),
  });
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
      setValues({
        ...EMPTY_SUBMIT_FORM,
        expenseDate: todayStr(),
      });
      onClose();
    } catch (err) {
      setServerError(describeSubmitError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit Expense Claim"
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4.5"
        noValidate
      >
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Add details for your expense claim.
          </p>
        </div>

        {/* Expense Type */}
        <FormField label="Expense Type" required error={errors.expenseType}>
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
              <option value="">Select expense type</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Amount */}
        <FormField label="Amount (INR)" required error={errors.amount}>
          {(f) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-sm font-semibold text-gray-500">
                ₹
              </span>
              <Input
                {...f}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter amount"
                invalid={f.invalid}
                value={values.amount || ""}
                disabled={submitting}
                className="pl-8"
                onChange={(e) =>
                  setValues((v) => ({ ...v, amount: Number(e.target.value) }))
                }
              />
            </div>
          )}
        </FormField>

        {/* Expense Date */}
        <FormField label="Expense Date" required error={errors.expenseDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.expenseDate}
              max={todayStr()}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, expenseDate: e.target.value }))
              }
            />
          )}
        </FormField>

        {/* Description */}
        <FormField
          label="Description"
          required
          error={errors.description}
          labelAction={
            <span className="text-theme-xs text-gray-400 font-normal">
              {values.description?.length ?? 0}/300
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              placeholder="Enter expense description..."
              invalid={f.invalid}
              value={values.description}
              disabled={submitting}
              maxLength={300}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
            />
          )}
        </FormField>

        {/* Receipt Reference */}
        <FormField
          label="Receipt Reference (Optional)"
          error={errors.receiptRef}
          hint="Free text reference (e.g. Bill number, invoice number)."
        >
          {(f) => (
            <Input
              {...f}
              placeholder="e.g. Bill number, invoice number"
              invalid={f.invalid}
              value={values.receiptRef}
              disabled={submitting}
              maxLength={100}
              onChange={(e) =>
                setValues((v) => ({ ...v, receiptRef: e.target.value }))
              }
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit claim">
            {serverError}
          </Alert>
        ) : null}

        {/* Actions */}
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
            Submit Claim
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
