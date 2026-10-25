import React, { useState, useEffect } from "react";
import { ProposalDocument } from "../proposalTypes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  AlertCircle,
  Sparkles,
  MessageSquare,
  History,
} from "lucide-react";

interface ExtendFollowupModalProps {
  open: boolean;
  onClose: () => void;
  proposal: ProposalDocument | null;
  currentDueDate?: string;
  onConfirm: (newDate: string, reason: string) => Promise<void> | void;
}

const COMMON_REASONS = [
  "Client requested more time to review",
  "Awaiting internal management / budget approval",
  "Client key stakeholder is on leave / unavailable",
  "Technical review & scope adjustments in progress",
  "Commercial pricing & payment terms renegotiation",
  "Scheduled demo / technical presentation next week",
];

export function ExtendFollowupModal({
  open,
  onClose,
  proposal,
  currentDueDate,
  onConfirm,
}: ExtendFollowupModalProps) {
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset when opened
  useEffect(() => {
    if (open) {
      const existing =
        currentDueDate || proposal?.dueDate || proposal?.due_date || "";
      // Default to next week if existing is past or today
      const today = new Date();
      let target = new Date();
      if (existing) {
        const parsed = new Date(existing);
        if (!isNaN(parsed.getTime()) && parsed > today) {
          target = new Date(parsed);
          target.setDate(target.getDate() + 7);
        } else {
          target.setDate(today.getDate() + 7);
        }
      } else {
        target.setDate(today.getDate() + 7);
      }
      setNewDate(target.toISOString().split("T")[0]);
      setReason("");
      setSubmitting(false);
    }
  }, [open, currentDueDate, proposal]);

  if (!proposal) return null;

  const effectiveOldDate =
    currentDueDate || proposal.dueDate || proposal.due_date || "";

  const applyOffset = (days: number) => {
    const base = effectiveOldDate ? new Date(effectiveOldDate) : new Date();
    const effectiveBase =
      isNaN(base.getTime()) || base < new Date() ? new Date() : base;
    effectiveBase.setDate(effectiveBase.getDate() + days);
    setNewDate(effectiveBase.toISOString().split("T")[0]);
  };

  const handleConfirm = async () => {
    if (!newDate) return;
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(newDate, reason.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-6 shadow-2xl border-slate-200 bg-white">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Extend Follow-up Due Date
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Postpone client follow-up deadline and document the operational
            reason for governance and audit tracking.
          </DialogDescription>
        </DialogHeader>

        {/* Proposal Quick Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 my-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
              {proposal.proposalNumber}
            </span>
            {proposal.followUpExtensionCount ? (
              <Badge
                variant="outline"
                className="text-[10px] font-bold text-amber-800 bg-amber-50 border-amber-300"
              >
                Extended {proposal.followUpExtensionCount}x previously
              </Badge>
            ) : null}
          </div>
          <p className="text-xs font-bold text-slate-800 truncate">
            {proposal.title || "Client Proposal"}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
            <span>
              Client:{" "}
              <strong className="text-slate-800">
                {proposal.clientName || "N/A"}
              </strong>
            </span>
            <span>
              Current Due:{" "}
              <strong className="text-slate-800">
                {effectiveOldDate
                  ? new Date(effectiveOldDate).toLocaleDateString("en-GB")
                  : "None"}
              </strong>
            </span>
          </div>
        </div>

        {/* New Date Selection with Presets */}
        <div className="space-y-2 py-1">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>New Follow-up Due Date *</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyOffset(3)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => applyOffset(7)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
              >
                +1 Week
              </button>
              <button
                type="button"
                onClick={() => applyOffset(14)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
              >
                +2 Weeks
              </button>
              <button
                type="button"
                onClick={() => applyOffset(30)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
              >
                +1 Month
              </button>
            </div>
          </label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-2xl text-xs h-10 border-slate-200 bg-white"
          />
        </div>

        {/* Mandatory Extension Reason */}
        <div className="space-y-2 py-1">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              Reason for Date Extension *
            </span>
            <span className="text-[10px] text-rose-500 font-bold">
              Mandatory for Audit
            </span>
          </label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this follow-up is being extended (e.g., Client requested postponement after demo call, waiting for procurement meeting)..."
            className="rounded-2xl text-xs resize-none border-slate-200 bg-white"
          />

          {/* Clickable Quick Reason Suggestions */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-[10.5px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-600 transition-colors text-left"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || !newDate || !reason.trim()}
            style={{
              background:
                "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
            }}
            className="rounded-xl text-xs font-bold text-white shadow-md hover:opacity-95"
          >
            {submitting ? "Saving..." : "Confirm & Log Extension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
