// CRM Core Domain — Meeting Completion form. Every field here already exists on `CrmMeeting`
// (see `domain/types.ts`) — this is the missing UI that actually collects them when a meeting
// is marked Completed, via `completeCrmMeeting`.
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { celebrateCrm } from "../celebration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "../components/DatePicker";
import { completeCrmMeeting } from "./meetingsService";
import { CrmMeeting } from "./types";

export function MeetingCompleteDialog({
  meeting,
  open,
  onOpenChange,
  currentUser,
  renderAs = "dialog",
}: {
  meeting: CrmMeeting | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUser: string;
  /** 'dialog' (default, unchanged) renders as a modal — used by LeadDetail.tsx and any other
   *  existing caller. 'page' renders the exact same fields inline, with no Dialog wrapper/overlay
   *  — used by AccountDetail.tsx's Meetings tab so it appears inline instead of a modal. */
  renderAs?: "dialog" | "page";
}) {
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

  // Every field defaults empty and nothing was required — a meeting could be marked Completed
  // with zero outcome data recorded, unlike every sibling dialog in this module (LeadConvertDialog,
  // StatusTagDialog, OpportunityDrawer), which all validate a required field before allowing
  // submit. Require at least the summary, the one field that actually captures what happened.
  const isValid = form.summary.trim().length > 0;

  const save = async () => {
    if (!meeting || !isValid) return;
    setSaving(true);
    try {
      await completeCrmMeeting(meeting, form, currentUser);
      toast.success("Meeting marked completed");
      celebrateCrm("meeting.completed");
      onOpenChange(false);
      setForm({
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
    } catch (err) {
      console.error("Failed to complete meeting:", err);
      toast.error("Failed to save meeting completion. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const fields = (
    <>
      <div className="space-y-1.5">
        <Label>
          Meeting Summary <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={2}
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          placeholder="What was discussed…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client Requirements</Label>
        <Textarea
          rows={2}
          value={form.requirements}
          onChange={(e) =>
            setForm((f) => ({ ...f, requirements: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Concerns Raised</Label>
        <Textarea
          rows={2}
          value={form.concerns}
          onChange={(e) => setForm((f) => ({ ...f, concerns: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Competitors Mentioned</Label>
          <Input
            value={form.competitors}
            onChange={(e) =>
              setForm((f) => ({ ...f, competitors: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Budget</Label>
          <Input
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Decision Maker</Label>
          <Input
            value={form.decisionMaker}
            onChange={(e) =>
              setForm((f) => ({ ...f, decisionMaker: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Expected Timeline</Label>
          <Input
            value={form.expectedTimeline}
            onChange={(e) =>
              setForm((f) => ({ ...f, expectedTimeline: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Next Step</Label>
        <Input
          value={form.nextStep}
          onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))}
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
            onClick={save}
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
            onClick={save}
          >
            {saving ? "Saving…" : "Mark Completed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
