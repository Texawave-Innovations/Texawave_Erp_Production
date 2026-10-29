"use client";

import type { ProposalDocument } from "@texawave-erp/api-types";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import {
  formatDate,
  todayInput,
  toDateInput,
} from "@/features/projects/format";

function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ExtendFollowupModalProps {
  proposal: ProposalDocument | null;
  onClose: () => void;
  loading?: boolean;
  onConfirm: (input: {
    dueDate: string;
    reason: string;
  }) => void | Promise<void>;
}

/** Legacy `proposals/ExtendFollowupModal.tsx` — set or push out a
 * proposal's follow-up date with a reason that is kept in the audit trail
 * (legacy marked the reason "Mandatory for Audit"). */
export function ExtendFollowupModal({
  proposal,
  onClose,
  loading = false,
  onConfirm,
}: ExtendFollowupModalProps) {
  return proposal ? (
    <ExtendFollowupForm
      key={proposal.id}
      proposal={proposal}
      onClose={onClose}
      loading={loading}
      onConfirm={onConfirm}
    />
  ) : null;
}

function ExtendFollowupForm({
  proposal,
  onClose,
  loading,
  onConfirm,
}: {
  proposal: ProposalDocument;
  onClose: () => void;
  loading: boolean;
  onConfirm: ExtendFollowupModalProps["onConfirm"];
}) {
  const current = toDateInput(proposal.dueDate);
  const base = current && current > todayInput() ? current : todayInput();
  const [dueDate, setDueDate] = useState(addDays(base, 7));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ dueDate?: string; reason?: string }>(
    {},
  );

  function submit() {
    const next: typeof errors = {};
    if (!dueDate) next.dueDate = "Pick the new follow-up date.";
    else if (dueDate < todayInput())
      next.dueDate = "The follow-up date cannot be in the past.";
    if (reason.trim().length < 3)
      next.reason = "Give a reason — it is recorded in the audit trail.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void onConfirm({ dueDate, reason: reason.trim() });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={current ? "Extend Follow-up" : "Set Follow-up Date"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            <CalendarClock className="h-4 w-4" />
            Save Follow-up
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-theme-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <p className="text-theme-xs uppercase text-gray-500 dark:text-gray-400">
              Proposal
            </p>
            <p className="font-semibold text-gray-900 dark:text-white/90">
              {proposal.proposalNumber}
            </p>
          </div>
          <div>
            <p className="text-theme-xs uppercase text-gray-500 dark:text-gray-400">
              Current follow-up
            </p>
            <p className="font-semibold text-gray-900 dark:text-white/90">
              {current ? formatDate(current) : "Not set"}
              {proposal.followUpExtensionCount > 0
                ? ` · extended ${proposal.followUpExtensionCount}x`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[3, 7, 14, 30].map((d) => (
            <Button
              key={d}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDueDate(addDays(base, d))}
            >
              +{d} days
            </Button>
          ))}
        </div>
        <FormField label="New follow-up date" required error={errors.dueDate}>
          {(fp) => (
            <Input
              {...fp}
              type="date"
              min={todayInput()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Reason" required error={errors.reason}>
          {(fp) => (
            <Textarea
              {...fp}
              rows={3}
              placeholder="e.g. Client requested more time for internal budget approval"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
