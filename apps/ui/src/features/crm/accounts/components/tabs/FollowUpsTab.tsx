"use client";

import type {
  FollowUp,
  FollowUpPriority,
  FollowUpStatus,
} from "@texawave-erp/api-types";
import {
  ACTIVITY_TYPES,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
} from "@texawave-erp/api-types";
import {
  Button,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateFollowUp,
  useFollowUps,
  useRescheduleFollowUp,
  useUpdateFollowUpStatus,
} from "../../../follow-ups/hooks";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  PENDING: "brand",
  COMPLETED: "success",
  CANCELLED: "gray",
  RESCHEDULED: "warning",
  MISSED: "error",
  OVERDUE: "error",
};

function CreateFollowUpForm({
  accountId,
  onDone,
}: {
  accountId: number;
  onDone: () => void;
}) {
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>("Call");
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<FollowUpPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createMutation = useCreateFollowUp();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt || !assignedTo.trim()) {
      setError("Scheduled date and assignee are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        type,
        scheduledAt,
        assignedTo,
        priority,
        notes: notes || undefined,
      });
      toast({ title: "Follow-up created", variant: "success" });
      onDone();
    } catch {
      setError("Could not create the follow-up. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Type">
        {(fp) => (
          <Select
            {...fp}
            value={type}
            onChange={(e) => setType(e.target.value as never)}
          >
            {ACTIVITY_TYPES.filter((t) => t !== "Stage Change").map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Scheduled at" required>
        {(fp) => (
          <Input
            {...fp}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Assigned to" required>
        {(fp) => (
          <Input
            {...fp}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Priority">
        {(fp) => (
          <Select
            {...fp}
            value={priority}
            onChange={(e) => setPriority(e.target.value as FollowUpPriority)}
          >
            {FOLLOW_UP_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Notes">
        {(fp) => (
          <Textarea
            {...fp}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        )}
      </FormField>
      {error ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onDone}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Create
        </Button>
      </div>
    </form>
  );
}

function FollowUpRow({ followUp }: { followUp: FollowUp }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const updateStatus = useUpdateFollowUpStatus();
  const reschedule = useRescheduleFollowUp();
  const { toast } = useToast();

  async function setStatus(status: FollowUpStatus) {
    await updateStatus.mutateAsync({ id: followUp.id, input: { status } });
    toast({ title: `Follow-up marked ${status}`, variant: "success" });
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
            {followUp.type} — {followUp.assignedTo}
          </p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {new Date(followUp.scheduledAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge
          label={followUp.effectiveStatus}
          colorToken={STATUS_COLOR[followUp.effectiveStatus] ?? "gray"}
        />
      </div>
      <div className="flex gap-2">
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value)
              void setStatus(e.target.value as FollowUpStatus);
          }}
          className="max-w-[160px]"
        >
          <option value="">Change status…</option>
          {FOLLOW_UP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRescheduleOpen(true)}
        >
          Reschedule
        </Button>
      </div>
      <Dialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule follow-up"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await reschedule.mutateAsync({
              id: followUp.id,
              input: { newScheduledAt },
            });
            setRescheduleOpen(false);
            toast({ title: "Follow-up rescheduled", variant: "success" });
          }}
        >
          <FormField label="New scheduled at" required>
            {(fp) => (
              <Input
                {...fp}
                type="datetime-local"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
              />
            )}
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRescheduleOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Dialog>
    </li>
  );
}

/** Follow-ups tab: list showing `effectiveStatus` (never the stored
 * `status`, since `OVERDUE` is display-only) + create + status update +
 * reschedule. */
export function FollowUpsTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useFollowUps({
    relatedType: "account",
    relatedId: accountId,
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Follow-ups
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add Follow-up
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No follow-ups yet"
          description="Create the first follow-up."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((f) => (
            <FollowUpRow key={f.id} followUp={f} />
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add follow-up"
      >
        <CreateFollowUpForm
          accountId={accountId}
          onDone={() => setCreateOpen(false)}
        />
      </Dialog>
    </div>
  );
}
