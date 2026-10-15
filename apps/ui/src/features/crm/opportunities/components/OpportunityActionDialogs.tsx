"use client";

import type { Opportunity, PipelineStage } from "@texawave-erp/api-types";
import { HOLD_REASONS, LOST_REASONS } from "@texawave-erp/core";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useChangeOpportunityStage,
  useMarkOpportunityLost,
  useMarkOpportunityWon,
  useReopenOpportunity,
  useSetOpportunityOnHold,
} from "../hooks";

interface DialogShellProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  loading: boolean;
  children: React.ReactNode;
}

function DialogShell({
  title,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  loading,
  children,
}: DialogShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {children}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/** Reproduces legacy's drag-and-drop move confirm — a stage change
 * dragged on the Kanban board always requires non-empty remarks before it
 * commits (`Pipeline.tsx` `confirmPendingMove`: `if (!pendingMove ||
 * !moveRemarks.trim()) return;`). */
export function MoveStageDialog({
  opportunity,
  targetStage,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  targetStage: PipelineStage;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useChangeOpportunityStage();

  async function confirm() {
    try {
      await mutation.mutateAsync({
        id: opportunity.id,
        input: { stageId: targetStage.id, remarks: remarks.trim() },
      });
      onDone();
    } catch {
      setError("Could not move this deal — please try again.");
    }
  }

  return (
    <DialogShell
      title={`Move "${opportunity.title}" to ${targetStage.label}`}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmLabel="Move"
      confirmDisabled={!remarks.trim()}
      loading={mutation.isPending}
    >
      <FormField label="Remarks" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        )}
      </FormField>
      {error ? <p className="text-theme-xs text-error-600">{error}</p> : null}
    </DialogShell>
  );
}

export function MarkWonDialog({
  opportunity,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [closingAmount, setClosingAmount] = useState(
    opportunity.estimatedValue,
  );
  const [closingDate, setClosingDate] = useState(
    opportunity.expectedCloseDate?.slice(0, 10) ?? "",
  );
  const [remarks, setRemarks] = useState("");
  const mutation = useMarkOpportunityWon();

  async function confirm() {
    await mutation.mutateAsync({
      id: opportunity.id,
      input: {
        closingAmount: closingAmount === "" ? undefined : Number(closingAmount),
        closingDate: closingDate || undefined,
        remarks: remarks || undefined,
      },
    });
    onDone();
  }

  return (
    <DialogShell
      title={`Mark "${opportunity.title}" Won`}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmLabel="Mark Won"
      loading={mutation.isPending}
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Closing Amount">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Closing Date">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField label="Remarks">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        )}
      </FormField>
    </DialogShell>
  );
}

export function MarkLostDialog({
  opportunity,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [remarks, setRemarks] = useState("");
  const mutation = useMarkOpportunityLost();

  async function confirm() {
    await mutation.mutateAsync({
      id: opportunity.id,
      input: {
        reason,
        reasonOther: reasonOther || undefined,
        competitor: competitor || undefined,
        remarks: remarks || undefined,
      },
    });
    onDone();
  }

  return (
    <DialogShell
      title={`Mark "${opportunity.title}" Lost`}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmLabel="Mark Lost"
      confirmDisabled={!reason}
      loading={mutation.isPending}
    >
      <FormField label="Reason" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="" disabled>
              Select a reason
            </option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {reason === "Competitor Selected" ? (
        <FormField label="Competitor">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
            />
          )}
        </FormField>
      ) : null}
      {reason === "Other" ? (
        <FormField label="Describe the reason">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <FormField label="Remarks">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        )}
      </FormField>
    </DialogShell>
  );
}

export function SetOnHoldDialog({
  opportunity,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [expectedResumeDate, setExpectedResumeDate] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useSetOpportunityOnHold();

  async function confirm() {
    await mutation.mutateAsync({
      id: opportunity.id,
      input: {
        reason,
        reasonOther: reasonOther || undefined,
        expectedResumeDate: expectedResumeDate || undefined,
        notes: notes || undefined,
      },
    });
    onDone();
  }

  return (
    <DialogShell
      title={`Put "${opportunity.title}" On Hold`}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmLabel="Put On Hold"
      confirmDisabled={!reason}
      loading={mutation.isPending}
    >
      <FormField label="Reason" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="" disabled>
              Select a reason
            </option>
            {HOLD_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {reason === "Other" ? (
        <FormField label="Describe the reason">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <FormField label="Expected Resume Date">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="date"
            value={expectedResumeDate}
            onChange={(e) => setExpectedResumeDate(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Notes">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>
    </DialogShell>
  );
}

export function ReopenDialog({
  opportunity,
  stages,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  stages: PipelineStage[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const boardStages = stages
    .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);
  const [stageId, setStageId] = useState<number | undefined>(
    boardStages[0]?.id,
  );
  const mutation = useReopenOpportunity();

  async function confirm() {
    if (!stageId) return;
    await mutation.mutateAsync({ id: opportunity.id, input: { stageId } });
    onDone();
  }

  return (
    <DialogShell
      title={`Reopen "${opportunity.title}"`}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmLabel="Reopen"
      confirmDisabled={!stageId}
      loading={mutation.isPending}
    >
      <FormField label="Reopen into stage" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={stageId ?? ""}
            onChange={(e) => setStageId(Number(e.target.value))}
          >
            {boardStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    </DialogShell>
  );
}
