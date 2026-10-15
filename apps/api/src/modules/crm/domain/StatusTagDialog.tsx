// CRM Core Domain — unified status/tag control (section 11 of the CRM architecture brief).
// Replaces the old pattern of re-entering the same company into separate Not Interested / Keep
// in Touch / Call Back-Send Info legacy sheets: one status field on the Account, with the same
// "reason required" discipline the Opportunity Lost/Hold flows already use, and an auto-created
// trackable task for Keep in Touch / Call Back / Send Info so the follow-up isn't just a label.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { celebrateCrm } from "../celebration";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "../components/DateTimePicker";
import { DatePicker } from "../components/DatePicker";
import { changeCrmAccountStatusTag } from "./accountsService";
import { CrmAccount, CrmStatusTag, CrmTask } from "./types";

export const STATUS_TAGS: CrmStatusTag[] = [
  "Interested",
  "Not Interested",
  "Keep in Touch",
  "Call Back",
  "Send Info",
];

export const STATUS_TAG_STYLE: Record<CrmStatusTag, string> = {
  Interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Not Interested": "bg-red-50 text-red-700 border-red-200",
  "Keep in Touch": "bg-blue-50 text-blue-700 border-blue-200",
  "Call Back": "bg-amber-50 text-amber-700 border-amber-200",
  "Send Info": "bg-purple-50 text-purple-700 border-purple-200",
};

export function StatusTagDialog({
  account,
  currentUser,
  trigger,
  openTasks = [],
  onChanged,
}: {
  account: Pick<CrmAccount, "id" | "name" | "statusTag">;
  currentUser: string;
  trigger?: React.ReactNode;
  /** This account's currently Open tasks — passed through to `changeCrmAccountStatusTag` so a
   *  reschedule (saving the same status again with a new date) updates the existing follow-up
   *  task instead of creating a duplicate. */
  openTasks?: Pick<CrmTask, "id" | "title" | "status">[];
  /** Optional — called after the status is saved successfully, with the tag that was applied.
   *  Every existing caller omits this and is unaffected; added for callers (e.g. Cold Calling
   *  Status) that need to record elsewhere that a disposition was just routed. */
  onChanged?: (tag: CrmStatusTag) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<CrmStatusTag>(
    account.statusTag || "Interested",
  );
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [infoType, setInfoType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTag(account.statusTag || "Interested");
    setReason("");
    setDate("");
    setInfoType("");
    setError(null);
  }, [open, account.statusTag]);

  const isValid =
    tag === "Interested"
      ? true
      : tag === "Not Interested"
        ? reason.trim().length > 0
        : tag === "Keep in Touch"
          ? date.length > 0
          : tag === "Call Back"
            ? date.length > 0
            : tag === "Send Info"
              ? infoType.trim().length > 0
              : false;

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await changeCrmAccountStatusTag(
        account,
        tag,
        { reason, date, infoType },
        currentUser,
        openTasks,
      );
      toast.success(`Status set to ${tag}`);
      celebrateCrm(
        tag === "Not Interested"
          ? "account.notInterested"
          : "account.statusChanged",
      );
      onChanged?.(tag);
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update status. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger || (
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Status
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-brand-600" /> Update Status —{" "}
              {account.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    // `date` is shared between DatePicker (Keep in Touch) and DateTimePicker (Call
                    // Back), which parse it very differently — a datetime string left over from
                    // Call Back fails to parse as a plain date and shows Keep in Touch's field as
                    // an empty placeholder, while the stale unparsed string is still what actually
                    // gets submitted. Clear every type-specific field when the tag actually
                    // switches — but not on a re-click of the already-selected tag, which would
                    // otherwise wipe out whatever the user just entered for it.
                    if (t !== tag) {
                      setReason("");
                      setDate("");
                      setInfoType("");
                    }
                    setTag(t);
                  }}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    t === tag
                      ? STATUS_TAG_STYLE[t]
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tag === "Not Interested" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this account not interested?"
                  className="rounded-xl text-sm"
                />
              </div>
            )}
            {tag === "Keep in Touch" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Re-engage Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker value={date} onChange={setDate} />
              </div>
            )}
            {tag === "Call Back" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Call Back Date &amp; Time{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <DateTimePicker value={date} onChange={setDate} />
              </div>
            )}
            {tag === "Send Info" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Information Type <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={infoType}
                  onChange={(e) => setInfoType(e.target.value)}
                  placeholder="e.g. Pricing sheet, Product brochure"
                  className="rounded-xl"
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={!isValid || saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
