"use client";

import type {
  Meeting,
  MeetingMode,
  MeetingStatus,
} from "@texawave-erp/api-types";
import { MEETING_MODES, MEETING_STATUSES } from "@texawave-erp/api-types";
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
  useCompleteMeeting,
  useCreateMeeting,
  useMeetings,
  useRescheduleMeeting,
  useUpdateMeetingStatus,
} from "../../../meetings/hooks";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  REQUESTED: "gray",
  TENTATIVE: "warning",
  CONFIRMED: "brand",
  COMPLETED: "success",
  CANCELLED: "error",
  RESCHEDULED: "warning",
  NO_SHOW: "error",
};

function CreateMeetingForm({
  accountId,
  onDone,
}: {
  accountId: number;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<MeetingMode>("Online");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [agenda, setAgenda] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateMeeting();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingDate) {
      setError("Meeting date is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        mode,
        meetingDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        location: location || undefined,
        meetingLink: meetingLink || undefined,
        agenda: agenda || undefined,
      });
      toast({ title: "Meeting scheduled", variant: "success" });
      onDone();
    } catch {
      setError("Could not schedule the meeting. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Mode">
        {(fp) => (
          <Select
            {...fp}
            value={mode}
            onChange={(e) => setMode(e.target.value as MeetingMode)}
          >
            {MEETING_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Date" required>
        {(fp) => (
          <Input
            {...fp}
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Start time">
          {(fp) => (
            <Input
              {...fp}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={submitting}
              placeholder="10:00"
            />
          )}
        </FormField>
        <FormField label="End time">
          {(fp) => (
            <Input
              {...fp}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={submitting}
              placeholder="11:00"
            />
          )}
        </FormField>
      </div>
      <FormField label="Location">
        {(fp) => (
          <Input
            {...fp}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Meeting link">
        {(fp) => (
          <Input
            {...fp}
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Agenda">
        {(fp) => (
          <Textarea
            {...fp}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            disabled={submitting}
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
          Schedule
        </Button>
      </div>
    </form>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const updateStatus = useUpdateMeetingStatus();
  const reschedule = useRescheduleMeeting();
  const complete = useCompleteMeeting();
  const { toast } = useToast();

  async function setStatus(status: MeetingStatus) {
    await updateStatus.mutateAsync({ id: meeting.id, input: { status } });
    toast({ title: `Meeting marked ${status}`, variant: "success" });
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
            {meeting.meetingDate}{" "}
            {meeting.startTime ? `· ${meeting.startTime}` : ""}
          </p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {meeting.mode} {meeting.location ? `· ${meeting.location}` : ""}
          </p>
        </div>
        <StatusBadge
          label={meeting.status}
          colorToken={STATUS_COLOR[meeting.status] ?? "gray"}
        />
      </div>
      <div className="flex gap-2">
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) void setStatus(e.target.value as MeetingStatus);
          }}
          className="max-w-[160px]"
        >
          <option value="">Change status…</option>
          {MEETING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setCompleteOpen(true)}>
          Complete
        </Button>
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
        title="Reschedule meeting"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await reschedule.mutateAsync({
              id: meeting.id,
              input: { newDate },
            });
            setRescheduleOpen(false);
            toast({ title: "Meeting rescheduled", variant: "success" });
          }}
        >
          <FormField label="New date" required>
            {(fp) => (
              <Input
                {...fp}
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
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

      <Dialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete meeting"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await complete.mutateAsync({ id: meeting.id, input: { summary } });
            setCompleteOpen(false);
            toast({ title: "Meeting completed", variant: "success" });
          }}
        >
          <FormField label="Summary">
            {(fp) => (
              <Textarea
                {...fp}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
              />
            )}
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCompleteOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Complete</Button>
          </div>
        </form>
      </Dialog>
    </li>
  );
}

/** Meetings tab: list + create + status transition + complete + reschedule,
 * using the new meetings api/hooks, hardcoded to `relatedType: 'account'`. */
export function MeetingsTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useMeetings({
    relatedType: "account",
    relatedId: accountId,
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Meetings
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Schedule Meeting
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Schedule the first meeting."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((m) => (
            <MeetingRow key={m.id} meeting={m} />
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Schedule meeting"
      >
        <CreateMeetingForm
          accountId={accountId}
          onDone={() => setCreateOpen(false)}
        />
      </Dialog>
    </div>
  );
}
