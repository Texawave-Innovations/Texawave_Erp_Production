"use client";

import { useState } from "react";
import { resolveErrorText } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
} from "@texawave-erp/ui-kit";

/** Longest reason the API accepts. */
export const REASON_MAX = 500;

/** A document action that must say why (e.g. reopening a returned DC): the
 * confirm button stays disabled until a reason is typed. The reason is
 * recorded with the document and in its audit history. */
export function ReasonActionDialog({
  open,
  onClose,
  title,
  description,
  reasonLabel = "Reason",
  reasonHint,
  placeholder,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  reasonLabel?: string;
  reasonHint?: string;
  placeholder?: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = reason.trim();

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      setReason("");
    } catch (e) {
      setError(resolveErrorText(e, "sales.document.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title={title} size="md">
      <form onSubmit={handleConfirm} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        {error ? (
          <Alert variant="error" title="Not done">
            {error}
          </Alert>
        ) : null}
        <FormField
          label={reasonLabel}
          required
          {...(reasonHint ? { hint: reasonHint } : {})}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              {...(placeholder ? { placeholder } : {})}
            />
          )}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
