"use client";

import type { Meeting } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import { Textarea } from "@/components/legacy-ui/textarea";
import { celebrateCrm } from "@/features/crm/celebration";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { useCompleteMeeting } from "../../meetings/hooks";

const EMPTY_FORM = {
  summary: "",
  requirements: "",
  concerns: "",
  competitors: "",
  budget: "",
  decisionMaker: "",
  expectedTimeline: "",
  nextStep: "",
  nextFollowUpAt: "",
};

/** Legacy `domain/MeetingCompleteDialog.tsx` — collects the meeting outcome
 * (summary required) and marks it COMPLETED via `PATCH /crm/meetings/:id/complete`.
 * `renderAs="page"` renders the same fields inline (no modal). "Next Step" is a
 * free-text field stored on the meeting (`nextStep`). */
export function MeetingCompleteDialog({
  meeting,
  open,
  onOpenChange,
  renderAs = "dialog",
}: {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderAs?: "dialog" | "page";
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const completeMutation = useCompleteMeeting();
  const saving = completeMutation.isPending;
  const isValid = form.summary.trim().length > 0;

  async function save() {
    if (!meeting || !isValid) return;
    const clean = (v: string) => v.trim() || undefined;
    try {
      await completeMutation.mutateAsync({
        id: meeting.id,
        input: {
          summary: form.summary.trim(),
          requirements: clean(form.requirements),
          concerns: clean(form.concerns),
          competitors: clean(form.competitors),
          budget: clean(form.budget),
          decisionMaker: clean(form.decisionMaker),
          expectedTimeline: clean(form.expectedTimeline),
          nextStep: clean(form.nextStep),
          nextFollowUpAt: clean(form.nextFollowUpAt),
        },
      });
      toast.success("Meeting marked completed");
      celebrateCrm("meeting.completed");
      onOpenChange(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to save meeting completion. Please try again.",
      );
    }
  }

  const set =
    (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const fields = (
    <>
      <div className="space-y-1.5">
        <Label>
          Meeting Summary <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={2}
          value={form.summary}
          onChange={set("summary")}
          placeholder="What was discussed…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client Requirements</Label>
        <Textarea
          rows={2}
          value={form.requirements}
          onChange={set("requirements")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Concerns Raised</Label>
        <Textarea rows={2} value={form.concerns} onChange={set("concerns")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Competitors Mentioned</Label>
          <Input value={form.competitors} onChange={set("competitors")} />
        </div>
        <div className="space-y-1.5">
          <Label>Budget</Label>
          <Input value={form.budget} onChange={set("budget")} />
        </div>
        <div className="space-y-1.5">
          <Label>Decision Maker</Label>
          <Input value={form.decisionMaker} onChange={set("decisionMaker")} />
        </div>
        <div className="space-y-1.5">
          <Label>Expected Timeline</Label>
          <Input
            value={form.expectedTimeline}
            onChange={set("expectedTimeline")}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Next Step</Label>
        <Input
          value={form.nextStep}
          onChange={set("nextStep")}
          placeholder="e.g. Send proposal"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Next Follow-up Date</Label>
        <DatePicker
          value={form.nextFollowUpAt}
          onChange={(v) => setForm((f) => ({ ...f, nextFollowUpAt: v }))}
        />
      </div>
    </>
  );

  if (renderAs === "page") {
    if (!open) return null;
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Complete Meeting
              </h2>
              <p className="text-sm text-slate-400">
                Record what happened on this meeting.
              </p>
            </div>
          </div>
          <div className="space-y-3">{fields}</div>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            disabled={saving || !isValid}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Mark Completed"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Complete
            Meeting
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {fields}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={saving || !isValid}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Mark Completed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
