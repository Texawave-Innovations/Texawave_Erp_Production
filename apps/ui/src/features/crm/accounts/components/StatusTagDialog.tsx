"use client";

import {
  ACCOUNT_STATUS_TAGS,
  type ChangeAccountStatusTagFormValues,
  changeAccountStatusTagSchema,
} from "@texawave-erp/core";
import { Tag } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/components/legacy-ui/utils";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { DateTimePicker } from "@/features/crm/legacy-ui/DateTimePicker";

export interface StatusTagDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ChangeAccountStatusTagFormValues) => Promise<void>;
  currentStatusTag?: string | null | undefined;
  /** Optional account name shown in the title ("Update Status — Acme"). */
  accountName?: string | undefined;
}

export const STATUS_TAG_STYLE: Record<string, string> = {
  Interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Not Interested": "bg-red-50 text-red-700 border-red-200",
  "Keep in Touch": "bg-blue-50 text-blue-700 border-blue-200",
  "Call Back": "bg-amber-50 text-amber-700 border-amber-200",
  "Send Info": "bg-purple-50 text-purple-700 border-purple-200",
};

function initialTag(current: string | null | undefined): string {
  return current && (ACCOUNT_STATUS_TAGS as readonly string[]).includes(current)
    ? current
    : "Interested";
}

/** Legacy `domain/StatusTagDialog.tsx` visual port — tag chips + the per-tag
 * required companion field (reason/date/infoType), validated client-side via
 * `changeAccountStatusTagSchema` (mirrors `AccountsService.changeStatusTag`).
 * Props are unchanged from the pre-port version (plus optional `accountName`). */
export function StatusTagDialog({
  open,
  onClose,
  onSubmit,
  currentStatusTag,
  accountName,
}: StatusTagDialogProps) {
  const [statusTag, setStatusTag] = useState(initialTag(currentStatusTag));
  const [statusReason, setStatusReason] = useState("");
  const [statusDate, setStatusDate] = useState("");
  const [statusInfoType, setStatusInfoType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form every time the dialog (re)opens (adjust-state-during-render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setStatusTag(initialTag(currentStatusTag));
      setStatusReason("");
      setStatusDate("");
      setStatusInfoType("");
      setError(null);
    }
  }

  const isValid =
    statusTag === "Interested"
      ? true
      : statusTag === "Not Interested"
        ? statusReason.trim().length > 0
        : statusTag === "Keep in Touch" || statusTag === "Call Back"
          ? statusDate.length > 0
          : statusTag === "Send Info"
            ? statusInfoType.trim().length > 0
            : false;

  async function save() {
    if (!isValid) return;
    const result = changeAccountStatusTagSchema.safeParse({
      statusTag,
      statusReason,
      statusDate,
      statusInfoType,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid status details");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(result.data);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to update status. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand-600" /> Update Status
            {accountName ? ` — ${accountName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_STATUS_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  // `statusDate` is shared between DatePicker (Keep in Touch) and
                  // DateTimePicker (Call Back) which parse it differently — clear
                  // every type-specific field when the tag actually switches.
                  if (t !== statusTag) {
                    setStatusReason("");
                    setStatusDate("");
                    setStatusInfoType("");
                  }
                  setStatusTag(t);
                }}
                className={cn(
                  "rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  t === statusTag
                    ? STATUS_TAG_STYLE[t]
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {statusTag === "Not Interested" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                rows={2}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Why is this account not interested?"
                className="rounded-xl text-sm"
              />
            </div>
          )}
          {statusTag === "Keep in Touch" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Re-engage Date <span className="text-red-500">*</span>
              </Label>
              <DatePicker value={statusDate} onChange={setStatusDate} />
            </div>
          )}
          {statusTag === "Call Back" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Call Back Date &amp; Time{" "}
                <span className="text-red-500">*</span>
              </Label>
              <DateTimePicker value={statusDate} onChange={setStatusDate} />
            </div>
          )}
          {statusTag === "Send Info" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Information Type <span className="text-red-500">*</span>
              </Label>
              <Input
                value={statusInfoType}
                onChange={(e) => setStatusInfoType(e.target.value)}
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
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!isValid || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
