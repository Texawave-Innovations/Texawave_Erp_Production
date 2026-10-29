"use client";

import { Button, Dialog, FormField, Input } from "@texawave-erp/ui-kit";
import { GitBranch } from "lucide-react";
import { useState } from "react";

export interface StartRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  currentRevision: number;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

/** Legacy "Create Document Revision" prompt — a reason is mandatory and is
 * recorded permanently in the audit trail (API enforces 3–500 chars). */
export function StartRevisionDialog({
  open,
  onClose,
  currentRevision,
  loading = false,
  onConfirm,
}: StartRevisionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    if (reason.trim().length < 3) {
      setError("Give a short reason (at least 3 characters).");
      return;
    }
    setError(undefined);
    void Promise.resolve(onConfirm(reason.trim())).then(() => setReason(""));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Create Document Revision"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            <GitBranch className="h-4 w-4" />
            Start Revision {currentRevision + 1}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          Finalized minutes cannot be edited directly. This unlocks working
          revision {currentRevision + 1} while Revision {currentRevision} is
          kept on record.
        </p>
        <FormField
          label="Reason for revision"
          required
          error={error}
          hint="Recorded in the permanent document history."
        >
          {(fp) => (
            <Input
              {...fp}
              autoFocus
              placeholder="e.g. Corrected action item owners and target dates"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
