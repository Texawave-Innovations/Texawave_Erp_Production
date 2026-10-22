"use client";

import type { Meeting, MeetingMode } from "@texawave-erp/api-types";
import { MEETING_MODES } from "@texawave-erp/api-types";
import {
  CalendarClock,
  CheckCircle2,
  History,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { celebrateCrm } from "@/features/crm/celebration";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import {
  useCompleteMeeting,
  useCreateMeeting,
  useDeleteMeeting,
  useRescheduleMeeting,
  useUpdateMeetingStatus,
} from "@/features/crm/meetings/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  CANCEL_ROW_BTN_CLASS,
  COMPLETE_BTN_CLASS,
  CRM_DELETE_BTN_CLASS,
  FormRow,
  InlineFormPanel,
  MEETING_STATUS_STYLE,
  ROW_ACTION_BTN_CLASS,
  SectionShell,
} from "../accountUi";
import { RescheduleInlineForm } from "./RescheduleInlineForm";

function MeetingInlineForm({
  accountId,
  onCancel,
  onSaved,
}: {
  accountId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateMeeting();
  const [form, setForm] = useState({
    mode: "Online" as MeetingMode,
    meetingDate: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    agenda: "",
    participants: "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);

  const save = async () => {
    if (!form.meetingDate) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        mode: form.mode,
        meetingDate: form.meetingDate,
        startTime: opt(form.startTime),
        endTime: opt(form.endTime),
        location: opt(form.location),
        meetingLink: opt(form.meetingLink),
        agenda: opt(form.agenda),
        participants: opt(form.participants),
      });
      onSaved();
    } catch {
      toast.error("Failed to schedule meeting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={CalendarClock}
      title="Schedule Meeting"
      subtitle="Set up a meeting with this account."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Schedule"
      saving={saving}
      canSubmit={Boolean(form.meetingDate)}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Mode">
          <Select
            value={form.mode}
            onValueChange={(v) => set("mode", v as MeetingMode)}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEETING_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Date" required>
          <DatePicker
            className="h-9"
            value={form.meetingDate}
            onChange={(v) => set("meetingDate", v)}
          />
        </FormRow>
        <FormRow label="Start Time">
          <Input
            className="h-9 rounded-xl"
            type="time"
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
          />
        </FormRow>
        <FormRow label="End Time">
          <Input
            className="h-9 rounded-xl"
            type="time"
            value={form.endTime}
            onChange={(e) => set("endTime", e.target.value)}
          />
        </FormRow>
        <FormRow label="Location">
          <Input
            className="h-9 rounded-xl"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </FormRow>
        <FormRow label="Meeting Link">
          <Input
            className="h-9 rounded-xl"
            value={form.meetingLink}
            onChange={(e) => set("meetingLink", e.target.value)}
          />
        </FormRow>
        <FormRow label="Agenda" className="md:col-span-2">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.agenda}
            onChange={(e) => set("agenda", e.target.value)}
          />
        </FormRow>
        <FormRow label="Participants" className="md:col-span-2">
          <Input
            className="h-9 rounded-xl"
            value={form.participants}
            onChange={(e) => set("participants", e.target.value)}
            placeholder="Comma-separated names"
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

function MeetingCompleteInlineForm({
  meeting,
  onCancel,
  onSaved,
}: {
  meeting: Meeting;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const completeMutation = useCompleteMeeting();
  const [form, setForm] = useState({
    summary: "",
    requirements: "",
    concerns: "",
    competitors: "",
    budget: "",
    decisionMaker: "",
    expectedTimeline: "",
    nextStep: "",
    nextFollowUpAt: "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);

  const save = async () => {
    if (!form.summary.trim()) return;
    setSaving(true);
    try {
      await completeMutation.mutateAsync({
        id: meeting.id,
        input: {
          summary: form.summary.trim(),
          requirements: opt(form.requirements),
          concerns: opt(form.concerns),
          competitors: opt(form.competitors),
          budget: opt(form.budget),
          decisionMaker: opt(form.decisionMaker),
          expectedTimeline: opt(form.expectedTimeline),
          nextStep: opt(form.nextStep),
          nextFollowUpAt: opt(form.nextFollowUpAt),
        },
      });
      celebrateCrm("meeting.completed");
      onSaved();
    } catch {
      toast.error("Failed to complete meeting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={CheckCircle2}
      tone="emerald"
      title="Complete Meeting"
      subtitle="Record what happened on this meeting."
      note={null}
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Mark Completed"
      saving={saving}
      canSubmit={Boolean(form.summary.trim())}
    >
      <div className="space-y-3">
        <FormRow label="Meeting Summary" required>
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="What was discussed…"
          />
        </FormRow>
        <FormRow label="Client Requirements">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
          />
        </FormRow>
        <FormRow label="Concerns Raised">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.concerns}
            onChange={(e) => set("concerns", e.target.value)}
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Competitors Mentioned">
            <Input
              className="h-9 rounded-xl"
              value={form.competitors}
              onChange={(e) => set("competitors", e.target.value)}
            />
          </FormRow>
          <FormRow label="Budget">
            <Input
              className="h-9 rounded-xl"
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </FormRow>
          <FormRow label="Decision Maker">
            <Input
              className="h-9 rounded-xl"
              value={form.decisionMaker}
              onChange={(e) => set("decisionMaker", e.target.value)}
            />
          </FormRow>
          <FormRow label="Expected Timeline">
            <Input
              className="h-9 rounded-xl"
              value={form.expectedTimeline}
              onChange={(e) => set("expectedTimeline", e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label="Next Step">
          <Input
            className="rounded-xl"
            value={form.nextStep}
            onChange={(e) => set("nextStep", e.target.value)}
            placeholder="e.g. Send proposal"
          />
        </FormRow>
        <FormRow label="Next Follow-up Date">
          <DatePicker
            className="h-9"
            value={form.nextFollowUpAt}
            onChange={(v) => set("nextFollowUpAt", v)}
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

export function MeetingsTab({
  accountId,
  meetings,
}: {
  accountId: number;
  meetings: Meeting[];
}) {
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<Meeting | null>(null);
  const [rescheduling, setRescheduling] = useState<Meeting | null>(null);
  const canDelete = usePermission("crm.meeting.delete");
  const updateStatus = useUpdateMeetingStatus();
  const reschedule = useRescheduleMeeting();
  const deleteMutation = useDeleteMeeting();

  if (creating) {
    return (
      <MeetingInlineForm
        accountId={accountId}
        onCancel={() => setCreating(false)}
        onSaved={() => setCreating(false)}
      />
    );
  }
  if (completing) {
    return (
      <MeetingCompleteInlineForm
        meeting={completing}
        onCancel={() => setCompleting(null)}
        onSaved={() => setCompleting(null)}
      />
    );
  }
  if (rescheduling) {
    return (
      <RescheduleInlineForm
        currentDate={rescheduling.meetingDate}
        label="meeting"
        onCancel={() => setRescheduling(null)}
        onConfirm={(newDate, reason) =>
          reschedule.mutateAsync({
            id: rescheduling.id,
            input: { newDate, reason },
          })
        }
        onSaved={() => setRescheduling(null)}
      />
    );
  }

  return (
    <SectionShell
      title="Meetings"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Schedule Meeting
        </Button>
      }
    >
      {meetings.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No meetings yet" />
      ) : (
        <div className="divide-y divide-slate-100">
          {meetings.map((m) => {
            const isDone = m.status === "COMPLETED" || m.status === "CANCELLED";
            return (
              <div key={m.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {m.mode} meeting — {m.meetingDate.slice(0, 10)}
                      {m.startTime ? ` at ${m.startTime}` : ""}
                    </p>
                    {m.agenda && (
                      <p className="text-sm text-slate-900 mt-1">{m.agenda}</p>
                    )}
                    {m.location && (
                      <p className="text-sm text-slate-900 mt-0.5">
                        {m.location}
                      </p>
                    )}
                    {m.status === "COMPLETED" && m.summary && (
                      <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-1.5">
                        {m.summary}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "border shrink-0",
                      MEETING_STATUS_STYLE[m.status],
                    )}
                  >
                    {m.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!isDone && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className={COMPLETE_BTN_CLASS}
                        onClick={() => setCompleting(m)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={ROW_ACTION_BTN_CLASS}
                        onClick={() => setRescheduling(m)}
                      >
                        <History className="h-3 w-3" /> Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={CANCEL_ROW_BTN_CLASS}
                        onClick={() =>
                          updateStatus.mutate({
                            id: m.id,
                            input: { status: "CANCELLED" },
                          })
                        }
                      >
                        <XCircle className="h-3 w-3" /> Cancel
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <DeleteConfirmDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className={CRM_DELETE_BTN_CLASS}
                          title="Delete meeting"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      }
                      title="Delete this meeting?"
                      description="This meeting and its recorded outcome will be moved to the CRM Recycle Bin."
                      onConfirm={async () => {
                        await deleteMutation.mutateAsync(m.id);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
