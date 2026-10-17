"use client";

import type { FollowUp, FollowUpPriority } from "@texawave-erp/api-types";
import { ACTIVITY_TYPES, FOLLOW_UP_PRIORITIES } from "@texawave-erp/api-types";
import {
  CheckCircle2,
  Clock3,
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
  useCreateFollowUp,
  useDeleteFollowUp,
  useRescheduleFollowUp,
  useUpdateFollowUpStatus,
} from "@/features/crm/follow-ups/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { usePermission } from "@/hooks/usePermission";
import {
  CANCEL_ROW_BTN_CLASS,
  COMPLETE_BTN_CLASS,
  CRM_DELETE_BTN_CLASS,
  FOLLOWUP_STATUS_STYLE,
  FormRow,
  InlineFormPanel,
  ROW_ACTION_BTN_CLASS,
  SectionShell,
} from "../accountUi";
import { RescheduleInlineForm } from "./RescheduleInlineForm";

type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number];

function FollowUpInlineForm({
  accountId,
  currentUser,
  onCancel,
  onSaved,
}: {
  accountId: number;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateFollowUp();
  const [form, setForm] = useState({
    type: "Call" as ActivityTypeValue,
    scheduledAt: "",
    assignedTo: currentUser,
    priority: "Medium" as FollowUpPriority,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.scheduledAt || !form.assignedTo.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        type: form.type,
        scheduledAt: form.scheduledAt,
        assignedTo: form.assignedTo.trim(),
        priority: form.priority,
        notes: form.notes.trim() || undefined,
      });
      onSaved();
    } catch {
      toast.error("Failed to add follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={Clock3}
      title="Add Follow-up"
      subtitle="Schedule a follow-up for this account."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Add Follow-up"
      saving={saving}
      canSubmit={Boolean(form.scheduledAt && form.assignedTo.trim())}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Type">
          <Select
            value={form.type}
            onValueChange={(v) => set("type", v as ActivityTypeValue)}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.filter((t) => t !== "Stage Change").map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Scheduled Date" required>
          <DatePicker
            className="h-9"
            value={form.scheduledAt}
            onChange={(v) => set("scheduledAt", v)}
          />
        </FormRow>
        <FormRow label="Assigned To">
          <Input
            className="h-9 rounded-xl"
            value={form.assignedTo}
            onChange={(e) => set("assignedTo", e.target.value)}
          />
        </FormRow>
        <FormRow label="Priority">
          <Select
            value={form.priority}
            onValueChange={(v) => set("priority", v as FollowUpPriority)}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Notes" className="md:col-span-2">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

function FollowUpCompleteInlineForm({
  followUp,
  onCancel,
  onSaved,
}: {
  followUp: FollowUp;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const updateStatus = useUpdateFollowUpStatus();
  const [outcome, setOutcome] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateStatus.mutateAsync({
        id: followUp.id,
        input: {
          status: "COMPLETED",
          outcome: outcome.trim() || undefined,
          nextFollowUpAt: nextFollowUpAt || undefined,
        },
      });
      celebrateCrm("followup.completed");
      onSaved();
    } catch {
      toast.error("Failed to complete follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={CheckCircle2}
      tone="emerald"
      title="Complete Follow-up"
      subtitle="Record the outcome and, optionally, schedule the next one."
      note={null}
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Mark Completed"
      saving={saving}
    >
      <div className="space-y-4">
        <FormRow label="Outcome">
          <Textarea
            rows={3}
            className="rounded-xl"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What happened on this follow-up?"
          />
        </FormRow>
        <FormRow label="Next Follow-up Date (optional)">
          <DatePicker
            className="h-9"
            value={nextFollowUpAt}
            onChange={setNextFollowUpAt}
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

export function FollowUpsTab({
  accountId,
  currentUser,
  followUps,
}: {
  accountId: number;
  currentUser: string;
  followUps: FollowUp[];
}) {
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<FollowUp | null>(null);
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null);
  const canDelete = usePermission("crm.followup.delete");
  const updateStatus = useUpdateFollowUpStatus();
  const reschedule = useRescheduleFollowUp();
  const deleteMutation = useDeleteFollowUp();

  if (creating) {
    return (
      <FollowUpInlineForm
        accountId={accountId}
        currentUser={currentUser}
        onCancel={() => setCreating(false)}
        onSaved={() => setCreating(false)}
      />
    );
  }
  if (completing) {
    return (
      <FollowUpCompleteInlineForm
        followUp={completing}
        onCancel={() => setCompleting(null)}
        onSaved={() => setCompleting(null)}
      />
    );
  }
  if (rescheduling) {
    return (
      <RescheduleInlineForm
        currentDate={rescheduling.scheduledAt}
        label="follow-up"
        onCancel={() => setRescheduling(null)}
        onConfirm={(newDate, reason) =>
          reschedule.mutateAsync({
            id: rescheduling.id,
            input: { newScheduledAt: newDate, reason },
          })
        }
        onSaved={() => setRescheduling(null)}
      />
    );
  }

  return (
    <SectionShell
      title="Follow-ups"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Follow-up
        </Button>
      }
    >
      {followUps.length === 0 ? (
        <EmptyState icon={Clock3} title="No follow-ups yet" />
      ) : (
        <div className="divide-y divide-slate-100">
          {followUps.map((f) => {
            const isDone = f.status === "COMPLETED" || f.status === "CANCELLED";
            const historyCount = f.reschedules.length;
            return (
              <div key={f.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {f.type} — {f.scheduledAt.slice(0, 10)}
                    </p>
                    <p className="text-sm text-slate-900 mt-1">
                      Assigned to {f.assignedTo} · {f.priority} priority
                      {historyCount > 0
                        ? ` · rescheduled ${historyCount}×`
                        : ""}
                    </p>
                    {f.notes && (
                      <p className="text-sm text-slate-900 mt-0.5">{f.notes}</p>
                    )}
                    {f.status === "COMPLETED" && f.outcome && (
                      <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-1.5">
                        {f.outcome}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "border shrink-0",
                      FOLLOWUP_STATUS_STYLE[f.effectiveStatus],
                    )}
                  >
                    {f.effectiveStatus}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!isDone && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className={COMPLETE_BTN_CLASS}
                        onClick={() => setCompleting(f)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={ROW_ACTION_BTN_CLASS}
                        onClick={() => setRescheduling(f)}
                      >
                        <History className="h-3 w-3" /> Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={CANCEL_ROW_BTN_CLASS}
                        onClick={() =>
                          updateStatus.mutate({
                            id: f.id,
                            input: { status: "CANCELLED" },
                          })
                        }
                      >
                        <XCircle className="h-3 w-3" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs rounded-lg text-slate-900"
                        onClick={() =>
                          updateStatus.mutate({
                            id: f.id,
                            input: { status: "MISSED" },
                          })
                        }
                      >
                        Mark Missed
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
                          title="Delete follow-up"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      }
                      title="Delete this follow-up?"
                      description="This follow-up and its reschedule history will be moved to the CRM Recycle Bin."
                      onConfirm={async () => {
                        await deleteMutation.mutateAsync(f.id);
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
