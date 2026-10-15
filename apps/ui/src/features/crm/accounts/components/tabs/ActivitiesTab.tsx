"use client";

import type { ActivityDirection, ActivityType } from "@texawave-erp/api-types";
import { ACTIVITY_DIRECTIONS, ACTIVITY_TYPES } from "@texawave-erp/api-types";
import {
  Button,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useActivities, useCreateActivity } from "../../../activities/hooks";

function LogActivityForm({
  accountId,
  onDone,
}: {
  accountId: number;
  onDone: () => void;
}) {
  const [type, setType] = useState<ActivityType>("Call");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [direction, setDirection] = useState<ActivityDirection | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createMutation = useCreateActivity();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        type,
        subject,
        notes: notes || undefined,
        direction: direction || undefined,
      });
      toast({ title: "Activity logged", variant: "success" });
      onDone();
    } catch {
      setError("Could not log the activity. Try again.");
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
            onChange={(e) => setType(e.target.value as ActivityType)}
          >
            {ACTIVITY_TYPES.filter((t) => t !== "Stage Change").map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Subject" required error={error ?? undefined}>
        {(fp) => (
          <Input
            {...fp}
            invalid={fp.invalid}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      {type === "Email" ? (
        <FormField label="Direction">
          {(fp) => (
            <Select
              {...fp}
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as ActivityDirection)
              }
            >
              <option value="">—</option>
              {ACTIVITY_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}
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
          Log activity
        </Button>
      </div>
    </form>
  );
}

/** Activities tab: list + log-activity form, using the new activities
 * api/hooks, hardcoded to `relatedType: 'account'`. */
export function ActivitiesTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useActivities({
    relatedType: "account",
    relatedId: accountId,
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Activities
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Log Activity
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No activities yet"
          description="Log the first activity."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between">
                <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {a.type} — {a.subject}
                </p>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {new Date(a.occurredAt).toLocaleString()}
                </span>
              </div>
              {a.notes ? (
                <p className="text-theme-xs text-gray-600 dark:text-gray-400">
                  {a.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log activity"
      >
        <LogActivityForm
          accountId={accountId}
          onDone={() => setCreateOpen(false)}
        />
      </Dialog>
    </div>
  );
}
