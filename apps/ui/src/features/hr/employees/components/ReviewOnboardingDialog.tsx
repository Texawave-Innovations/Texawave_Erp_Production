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
import { useReviewOnboarding } from "../hooks";

export type ReviewDecision = "approve" | "send_back";

export interface ReviewOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  employee: { id: number; fullName: string };
  decision: ReviewDecision;
}

/** Turns the review API's refusals into a sentence HR can act on. */
function describeReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "ONBOARDING_INCOMPLETE":
        return `${error.message}. Ask the employee to finish these, or send the profile back.`;
      case "ONBOARDING_NOT_PENDING_REVIEW":
        return "This profile is no longer waiting for review. Reload to see its current state.";
      case "SELF_REVIEW_FORBIDDEN":
        return "You cannot review your own onboarding profile.";
      default:
        if (error.isPermissionError)
          return "You don't have permission to review onboarding profiles.";
        if (error.isNotFound)
          return "This employee does not exist, or is outside your teams.";
        return error.message;
    }
  }
  return "Could not save the review. Try again.";
}

/**
 * Approve (note optional) or send back (note required, shown to the employee
 * and reopens their onboarding wizard). Mirrors ApproveOnboardingDto /
 * SendBackOnboardingDto: 3–1000 characters when sending back, ≤ 1000 to approve.
 */
export function ReviewOnboardingDialog({
  open,
  onClose,
  employee,
  decision,
}: ReviewOnboardingDialogProps) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useReviewOnboarding();
  const { toast } = useToast();
  const sendBack = decision === "send_back";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = note.trim();
    if (sendBack && trimmed.length < 3) {
      setNoteError("Tell the employee what to correct (at least 3 characters)");
      return;
    }
    if (trimmed.length > 1000) {
      setNoteError("Keep the note to 1000 characters or fewer");
      return;
    }
    setNoteError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({ id: employee.id, decision, note: trimmed });
      toast({
        title: sendBack
          ? `Profile sent back to ${employee.fullName}`
          : `${employee.fullName}'s onboarding approved`,
        variant: "success",
      });
      onClose();
    } catch (error) {
      setServerError(describeReviewError(error));
    }
  }

  const submitting = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={sendBack ? "Send profile back" : "Approve onboarding"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {sendBack ? (
            <>
              {employee.fullName} will see your note and their onboarding form
              will open again so they can correct it and resubmit.
            </>
          ) : (
            <>
              Confirms that you checked the details {employee.fullName}{" "}
              submitted. Their portal access is not affected.
            </>
          )}
        </p>
        <FormField
          label={sendBack ? "What needs to change" : "Note (optional)"}
          required={sendBack}
          error={noteError ?? undefined}
          hint={
            sendBack
              ? "Shown to the employee. 3–1000 characters."
              : "Kept with the review. Up to 1000 characters."
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={4}
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
          <Button type="submit" loading={submitting}>
            {sendBack ? "Send back" : "Approve"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
