"use client";

import type {
  ActivityDirection,
  ActivityType,
  CrmActivity,
} from "@texawave-erp/api-types";
import { ACTIVITY_DIRECTIONS, ACTIVITY_TYPES } from "@texawave-erp/api-types";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  useCreateActivity,
  useDeleteActivity,
} from "@/features/crm/activities/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import {
  CRM_DELETE_BTN_CLASS,
  FormRow,
  InlineFormPanel,
  SectionShell,
} from "../accountUi";

/** datetime-local reads/writes LOCAL time but toISOString() is UTC — shift by the offset first. */
function nowLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function ActivityInlineForm({
  accountId,
  onCancel,
  onSaved,
}: {
  accountId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateActivity();
  const [form, setForm] = useState({
    type: "Call" as ActivityType,
    subject: "",
    notes: "",
    occurredAt: nowLocal(),
    direction: "" as ActivityDirection | "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        type: form.type,
        subject: form.subject.trim(),
        notes: form.notes.trim() || undefined,
        direction:
          form.type === "Email" && form.direction ? form.direction : undefined,
        occurredAt: form.occurredAt
          ? new Date(form.occurredAt).toISOString()
          : undefined,
      });
      onSaved();
    } catch {
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={ListChecks}
      title="Log Activity"
      subtitle="Record an interaction with this account."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Log Activity"
      saving={saving}
      canSubmit={Boolean(form.subject.trim())}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Type">
          <Select
            value={form.type}
            onValueChange={(v) => set("type", v as ActivityType)}
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
        <FormRow label="When">
          <Input
            className="h-9 rounded-xl"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => set("occurredAt", e.target.value)}
          />
        </FormRow>
        <FormRow label="Subject" required className="md:col-span-2">
          <Input
            className="h-9 rounded-xl"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
          />
        </FormRow>
        {form.type === "Email" && (
          <FormRow label="Direction">
            <Select
              value={form.direction || "none"}
              onValueChange={(v) =>
                set("direction", v === "none" ? "" : (v as ActivityDirection))
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {ACTIVITY_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        )}
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

export function ActivitiesTab({
  accountId,
  activities,
}: {
  accountId: number;
  activities: CrmActivity[];
}) {
  const [logging, setLogging] = useState(false);
  const canDelete = usePermission("crm.activity.delete");
  const deleteMutation = useDeleteActivity();

  if (logging) {
    return (
      <ActivityInlineForm
        accountId={accountId}
        onCancel={() => setLogging(false)}
        onSaved={() => setLogging(false)}
      />
    );
  }

  return (
    <SectionShell
      title="Activities"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setLogging(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Log Activity
        </Button>
      }
    >
      {activities.length === 0 ? (
        <EmptyState icon={ListChecks} title="No activities logged yet" />
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((a) => (
            <div
              key={a.id}
              className="p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {a.type} — {a.subject}
                </p>
                <p className="text-sm text-slate-900 mt-0.5">
                  {new Date(a.occurredAt).toLocaleString()}
                  {a.createdByName ? ` · ${a.createdByName}` : ""}
                </p>
                {a.notes && (
                  <p className="text-sm text-slate-900 mt-1">{a.notes}</p>
                )}
              </div>
              {canDelete && (
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className={CRM_DELETE_BTN_CLASS}
                      title="Delete activity"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  }
                  title="Delete this activity?"
                  description="This logged activity will be moved to the CRM Recycle Bin."
                  onConfirm={async () => {
                    await deleteMutation.mutateAsync(a.id);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
