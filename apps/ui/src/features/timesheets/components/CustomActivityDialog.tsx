"use client";

import { useState } from "react";
import { businessToday, resolveErrorText } from "@texawave-erp/core";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import {
  useActivityCategories,
  useCreateCustomActivity,
  useLinkableProjects,
  useUpdateCustomActivity,
} from "../hooks";
import type { CustomActivityInput, TimesheetRow } from "../types";

/** `"14:00"` -> minutes since midnight; null when not a time. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** An instant as the IST `HH:mm` the employee typed (24-hour). */
function istTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function describeDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Add or edit a custom activity — work that is not an assigned task (a meeting,
 * a discussion, research...). The employee types a date and IST start/end
 * times; the server builds the instants and calculates the duration, so the
 * duration shown here is only a preview. A date before today is a late entry
 * and needs a reason. Mounted fresh each time it opens (the parent renders it
 * only while open), so its fields always start from the right values.
 */
export function CustomActivityDialog({
  onClose,
  defaultDate,
  editing,
}: {
  onClose: () => void;
  defaultDate: string;
  editing: TimesheetRow | null;
}) {
  const { notify } = useNotify();
  const categories = useActivityCategories();
  const projects = useLinkableProjects();
  const create = useCreateCustomActivity();
  const update = useUpdateCustomActivity();

  const [category, setCategory] = useState(editing?.category ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [projectId, setProjectId] = useState(
    editing?.projectId ? String(editing.projectId) : "",
  );
  const [workDate, setWorkDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(
    istTime(editing?.startedAt ?? null),
  );
  const [endTime, setEndTime] = useState(istTime(editing?.endedAt ?? null));
  const [reason, setReason] = useState(editing?.lateEntryReason ?? "");
  const [error, setError] = useState<string | null>(null);

  const today = businessToday();
  const isLate = workDate < today;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const previewMinutes =
    start !== null && end !== null && end > start ? end - start : null;
  const saving = create.isPending || update.isPending;

  function validate(): string | null {
    if (!category) return "Choose an activity category.";
    if (!title.trim()) return "Activity title is required.";
    if (!workDate) return "Choose the date of the activity.";
    if (start === null || end === null) return "Enter a start and an end time.";
    if (end <= start) return "End time must be after the start time.";
    if (isLate && !reason.trim()) {
      return "A reason is required for an activity recorded after its day.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    const input: CustomActivityInput = {
      category,
      title: title.trim(),
      workDate,
      startTime,
      endTime,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(projectId
        ? { projectId: Number(projectId) }
        : editing?.projectId
          ? { projectId: null }
          : {}),
      ...(isLate && reason.trim() ? { lateEntryReason: reason.trim() } : {}),
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
        notify("timesheets.activity.updated");
      } else {
        await create.mutateAsync(input);
        notify("timesheets.activity.added");
      }
      onClose();
    } catch (err) {
      setError(resolveErrorText(err, "timesheets.activity.saveFailed"));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={editing ? "Edit activity" : "Add custom activity"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          For work that is not an assigned task — a meeting, a discussion,
          research. Times are in IST; the duration is calculated for you.
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
          >
            {error}
          </p>
        ) : null}

        <FormField label="Category" required>
          {(field) => (
            <Select
              {...field}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Activity title" required>
          {(field) => (
            <Input
              {...field}
              value={title}
              maxLength={255}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Internal team discussion"
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Date" required>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={workDate}
                max={today}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Start time (IST)" required>
            {(field) => (
              <Input
                {...field}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="End time (IST)" required>
            {(field) => (
              <Input
                {...field}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <p
          aria-live="polite"
          className="text-xs font-semibold text-gray-600 dark:text-gray-300"
        >
          {previewMinutes !== null
            ? `Duration: ${describeDuration(previewMinutes)}`
            : "Duration appears once both times are valid."}
        </p>

        {isLate ? (
          <FormField
            label="Reason for the late entry"
            required
            hint="This is recorded after its day, so it is flagged for your reviewer."
          >
            {(field) => (
              <Textarea
                {...field}
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Forgot to log it on the day"
              />
            )}
          </FormField>
        ) : null}

        <FormField label="Project (optional)">
          {(field) => (
            <Select
              {...field}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Description (optional)">
          {(field) => (
            <Textarea
              {...field}
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        <FormField label="Remarks (optional)">
          {(field) => (
            <Textarea
              {...field}
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Save changes" : "Add activity"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
