"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Dialog,
  FormField,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useDecideExpenseClaim } from "../hooks";
import { decideExpenseClaimSchema } from "../schema";
import type { ExpenseClaimItem } from "../types";

export interface DecideExpenseClaimDialogProps {
  open: boolean;
  onClose: () => void;
  claim: Pick<
    ExpenseClaimItem,
    "id" | "employee" | "expenseType" | "amount" | "expenseDate" | "description"
  >;
  decision: "APPROVED" | "REJECTED";
}

function describeDecideError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_APPROVAL_FORBIDDEN") {
      return "You cannot approve or reject your own expense claim.";
    }
    if (error.errorCode === "DECISION_SCOPE_REQUIRED") {
      return "Deciding a claim requires team or organization scope.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to decide this expense claim.";
    }
    if (error.statusCode === 404) {
      return "This expense claim is no longer in your approval queue.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This claim has already been decided.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the character limit and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve/reject a PENDING expense claim. The note is optional for both
 * decisions (legacy parity). Decisions are final — maker-checker and scope
 * are enforced server-side (403 SELF_APPROVAL_FORBIDDEN /
 * DECISION_SCOPE_REQUIRED), never by this dialog. */
export function DecideExpenseClaimDialog({
  open,
  onClose,
  claim,
  decision,
}: DecideExpenseClaimDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const decide = useDecideExpenseClaim();
  const { toast } = useToast();

  const submitting = decide.isPending;
  const title =
    decision === "APPROVED" ? "Approve expense claim" : "Reject expense claim";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = decideExpenseClaimSchema.safeParse({ note });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await decide.mutateAsync({
        id: claim.id,
        body: {
          decision,
          ...(result.data.note ? { note: result.data.note } : {}),
        },
      });
      toast({
        title:
          decision === "APPROVED"
            ? "Expense claim approved"
            : "Expense claim rejected",
        variant: "success",
      });
      setNote("");
      onClose();
    } catch (err) {
      setServerError(describeDecideError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800">
          <p className="font-medium text-gray-900 dark:text-white/90">
            {claim.employee.fullName} — {claim.expenseType}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {claim.expenseDate} · {claim.amount.toFixed(2)}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {claim.description}
          </p>
        </div>
        <FormField
          label="Note to the employee"
          hint="Optional. Up to 500 characters."
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={note}
              disabled={submitting}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        {serverError ? (
          <p
            role="alert"
            className="text-theme-xs text-error-600 dark:text-error-400"
          >
            {serverError}
          </p>
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
          <Button
            type="submit"
            variant={decision === "REJECTED" ? "destructive" : "primary"}
            loading={submitting}
          >
            {decision === "APPROVED" ? "Approve" : "Reject"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
