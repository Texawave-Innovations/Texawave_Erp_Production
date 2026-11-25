"use client";

import { Button, ConfirmDialog } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { type MessageKey } from "@texawave-erp/core";
import { Trash2 } from "lucide-react";

/** Row action: the red trash icon every SCM list uses for "Delete". */
export function ScmDeleteButton({
  onClick,
  label = "Delete",
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={label}
      aria-label={label}
      disabled={disabled ?? false}
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4 text-error-600" />
    </Button>
  );
}

export interface ScmDeleteDialogProps<T> {
  /** The record being deleted; the dialog is open while this is set. */
  target: T | null;
  onClose: () => void;
  title: string;
  /** Body text for the confirmation. */
  describe: (target: T) => string;
  confirmText?: string;
  /** Performs the delete. May return the key of a message to show instead of `successMessage`. */
  run: (target: T) => Promise<MessageKey | void>;
  successMessage: MessageKey;
  errorFallback: MessageKey;
}

/** Confirm-then-delete flow shared by every SCM "Delete" action: confirms,
 * runs the mutation, toasts success or the server's refusal (the API blocks
 * a delete that would orphan other records) and closes. */
export function ScmDeleteDialog<T>({
  target,
  onClose,
  title,
  describe,
  confirmText = "Delete",
  run,
  successMessage,
  errorFallback,
}: ScmDeleteDialogProps<T>) {
  const { notify, notifyError } = useNotify();
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onClose={onClose}
      title={title}
      description={target ? describe(target) : ""}
      confirmText={confirmText}
      variant="destructive"
      onConfirm={async () => {
        if (!target) return;
        try {
          const message = await run(target);
          notify(message || successMessage);
        } catch (err) {
          notifyError(err, errorFallback);
        }
        onClose();
      }}
    />
  );
}
