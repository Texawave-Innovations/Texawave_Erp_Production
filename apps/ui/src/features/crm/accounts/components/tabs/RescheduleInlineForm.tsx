"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/legacy-ui/textarea";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { FormRow, InlineFormPanel } from "../accountUi";

/** Shared inline reschedule form for Meetings and Follow-ups — captures the new date and an
 * optional reason (the old date is kept in the record's reschedule history by the API). Renders
 * inline within the tab that opened it. */
export function RescheduleInlineForm({
  currentDate,
  label,
  onConfirm,
  onCancel,
  onSaved,
}: {
  currentDate: string;
  label: string;
  onConfirm: (newDate: string, reason?: string) => Promise<unknown>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [newDate, setNewDate] = useState(currentDate.slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await onConfirm(newDate, reason.trim() || undefined);
      onSaved();
    } catch {
      toast.error(`Failed to reschedule ${label}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={History}
      title={`Reschedule ${label.charAt(0).toUpperCase()}${label.slice(1)}`}
      subtitle="Pick a new date — the old one is kept in the reschedule history."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Reschedule"
      saving={saving}
      canSubmit={Boolean(newDate)}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="New Date" required>
          <DatePicker className="h-9" value={newDate} onChange={setNewDate} />
        </FormRow>
        <FormRow label="Reason (optional)" className="md:col-span-2">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being rescheduled?"
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}
