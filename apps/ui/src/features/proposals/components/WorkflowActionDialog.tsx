"use client";

import type {
  ProposalDocument,
  ProposalWorkflowAction,
} from "@texawave-erp/api-types";
import { Button, Dialog, FormField, Textarea } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { PROPOSAL_STATUS_META, WORKFLOW_ACTION_META } from "../utils";

export interface WorkflowActionTarget {
  proposal: ProposalDocument;
  action: ProposalWorkflowAction;
}

export interface WorkflowActionDialogProps {
  target: WorkflowActionTarget | null;
  onClose: () => void;
  loading?: boolean;
  onConfirm: (comments: string | undefined) => void | Promise<void>;
}

/** Legacy "quick status" modal (hub) and workflow confirm (editor): one
 * dialog per transition with an optional — or, for reject / request
 * changes, mandatory — comment that lands in the audit trail. The acting
 * user is taken from the session, not typed in (legacy let you type any
 * actor name/role). */
export function WorkflowActionDialog({
  target,
  onClose,
  loading = false,
  onConfirm,
}: WorkflowActionDialogProps) {
  return target ? (
    <ActionForm
      key={`${target.proposal.id}-${target.action}`}
      target={target}
      onClose={onClose}
      loading={loading}
      onConfirm={onConfirm}
    />
  ) : null;
}

function ActionForm({
  target,
  onClose,
  loading,
  onConfirm,
}: {
  target: WorkflowActionTarget;
  onClose: () => void;
  loading: boolean;
  onConfirm: WorkflowActionDialogProps["onConfirm"];
}) {
  const meta = WORKFLOW_ACTION_META[target.action];
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    if (meta.requireComment && !comments.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    void onConfirm(comments.trim() || undefined);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={meta.title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={meta.destructive ? "destructive" : "primary"}
            onClick={submit}
            loading={loading}
          >
            {meta.label}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          {meta.description}
        </p>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {target.proposal.proposalNumber} · currently{" "}
          <strong>{PROPOSAL_STATUS_META[target.proposal.status].label}</strong>
        </p>
        <FormField
          label={meta.requireComment ? "Reason" : "Comments (optional)"}
          required={meta.requireComment}
          error={error}
        >
          {(fp) => (
            <Textarea
              {...fp}
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                target.action === "record_accepted"
                  ? "Agreed variations, client PO reference, milestone schedule..."
                  : target.action === "record_rejected"
                    ? "Budget exceeded, scope mismatch, chose a competitor..."
                    : "Notes for the audit trail"
              }
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
