"use client";

// Shared Opportunity detail drawer (legacy `domain/OpportunityDrawer.tsx`). Used by the Pipeline
// board's quick view (side sheet) and by the Deal detail page's "Manage Stage / Won / Lost"
// action (`renderAs="page"`), so stage-change / Won / Lost / On Hold logic lives in one place.
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/legacy-ui/sheet";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import {
  celebrateCrm,
  celebrationKeyForStage,
} from "@/features/crm/celebration";
import { useActivities } from "@/features/crm/activities/hooks";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { useFollowUps } from "@/features/crm/follow-ups/hooks";
import { useMeetings } from "@/features/crm/meetings/hooks";
import { useQuotations } from "@/features/crm/quotations/hooks";
import { usePermission } from "@/hooks/usePermission";
import type { Opportunity } from "@texawave-erp/api-types";
import { HOLD_REASONS, LOST_REASONS, STUCK_REASONS } from "@texawave-erp/core";
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  Clock3,
  History,
  IndianRupee,
  PauseCircle,
  PlayCircle,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePipelineStages } from "../../pipeline-stages/hooks";
import {
  useChangeOpportunityStage,
  useDeleteOpportunity,
  useMarkOpportunityLost,
  useMarkOpportunityWon,
  useOpportunity,
  useReopenOpportunity,
  useSetOpportunityOnHold,
  useSetOpportunityStuckReason,
  useStageHistory,
} from "../hooks";
import {
  HEALTH_STYLE,
  OPPORTUNITY_WRITE_PERMS,
  STATUS_STYLE,
  computeOpportunityHealth,
  daysSince,
  fmtIN,
  num,
} from "../pipelineConfig";

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-sm text-slate-700 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

const CANCEL_BTN =
  "rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100";

export function OpportunityDrawer({
  opportunity: opportunityProp,
  accountName,
  open,
  onOpenChange,
  renderAs = "sheet",
}: {
  opportunity: Opportunity | null;
  accountName?: string | undefined;
  /** Accepted for parity with legacy callers; the acting user is resolved server-side now. */
  currentUser?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'sheet' renders a slide-in side panel (Pipeline quick view); 'page' renders the same
   * content inline without a Sheet wrapper (Deal detail's "Manage Stage"). */
  renderAs?: "sheet" | "page";
}) {
  const router = useRouter();
  // Prefer the live record (refetched after every mutation) over the snapshot the caller holds.
  const liveQuery = useOpportunity(opportunityProp?.id);
  const opportunity = liveQuery.data ?? opportunityProp;

  const [targetStage, setTargetStage] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostOther, setLostOther] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [showLostPicker, setShowLostPicker] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [wonAmount, setWonAmount] = useState("");
  const [wonDate, setWonDate] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdOther, setHoldOther] = useState("");
  const [expectedResumeDate, setExpectedResumeDate] = useState("");
  const [holdNotes, setHoldNotes] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeStage, setResumeStage] = useState("");
  const [stuckReason, setStuckReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = usePermission(OPPORTUNITY_WRITE_PERMS);
  const canDelete = usePermission("crm.opportunity.write.all");

  const stagesQuery = usePipelineStages();
  const stages = useMemo(() => stagesQuery.data ?? [], [stagesQuery.data]);
  const boardStages = useMemo(
    () =>
      stages
        .filter((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold)
        .sort((a, b) => a.order - b.order),
    [stages],
  );
  const stageLabel = (id: number) =>
    stages.find((s) => s.id === id)?.label ?? String(id);

  const historyQuery = useStageHistory(opportunity?.id);
  const history = historyQuery.data ?? [];

  const moveStage = useChangeOpportunityStage();
  const markWon = useMarkOpportunityWon();
  const markLost = useMarkOpportunityLost();
  const setOnHold = useSetOpportunityOnHold();
  const reopen = useReopenOpportunity();
  const setStuck = useSetOpportunityStuckReason();
  const deleteOpportunity = useDeleteOpportunity();

  const oppId = opportunity?.id;
  const oppStageId = opportunity?.stageId;
  const oppStuck = opportunity?.stuckReason;
  // Re-seed the form selects whenever the record (or its stage) changes — adjust-state-during-render.
  const syncKey = `${oppId}:${oppStageId}:${oppStuck}`;
  const [prevSyncKey, setPrevSyncKey] = useState("");
  if (oppId !== undefined && prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    setTargetStage(String(oppStageId ?? ""));
    setResumeStage(String(oppStageId ?? ""));
    setStuckReason(oppStuck ?? "");
  }

  const stageDef = stages.find((s) => s.id === opportunity?.stageId);
  const health = useMemo(
    () =>
      opportunity
        ? computeOpportunityHealth(
            opportunity.stageEnteredAt,
            opportunity.status,
            stageDef?.slaDays,
          )
        : "Healthy",
    [opportunity, stageDef?.slaDays],
  );

  // Linked records that the delete warning mentions (legacy cascade-deleted these).
  const related = {
    relatedType: "opportunity" as const,
    relatedId: oppId ?? 0,
  };
  const activitiesQ = useActivities({ ...related, limit: 1 });
  const meetingsQ = useMeetings({ ...related, limit: 1 });
  const followUpsQ = useFollowUps({ ...related, limit: 1 });
  const quotationsQ = useQuotations({ opportunityId: oppId ?? 0, limit: 1 });
  const linked = {
    activities: activitiesQ.data?.meta.total ?? 0,
    meetings: meetingsQ.data?.meta.total ?? 0,
    followUps: followUpsQ.data?.meta.total ?? 0,
    quotations: quotationsQ.data?.meta.total ?? 0,
  };
  const linkedTotal =
    linked.activities + linked.meetings + linked.followUps + linked.quotations;

  if (!opportunity) return null;
  const opp = opportunity;
  const estimated = num(opp.estimatedValue);
  const probability = opp.probability ?? stageDef?.probability ?? null;

  const handleMoveStage = async () => {
    if (!targetStage || Number(targetStage) === opp.stageId || !remarks.trim())
      return;
    setBusy(true);
    try {
      await moveStage.mutateAsync({
        id: opp.id,
        input: { stageId: Number(targetStage), remarks: remarks.trim() },
      });
      setRemarks("");
      const target = stages.find((s) => s.id === Number(targetStage));
      toast.success(`Moved to ${stageLabel(Number(targetStage))}`);
      celebrateCrm(celebrationKeyForStage(target?.code ?? target?.label ?? ""));
    } catch {
      toast.error("Failed to change stage");
    } finally {
      setBusy(false);
    }
  };

  const openWonModal = () => {
    setWonAmount(String(estimated || 0));
    setWonDate(
      opp.expectedCloseDate?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
    );
    setShowWonModal(true);
  };

  const handleConfirmWon = async () => {
    setBusy(true);
    try {
      await markWon.mutateAsync({
        id: opp.id,
        input: {
          closingAmount: Number(wonAmount) || estimated,
          closingDate: wonDate || undefined,
          remarks: remarks || undefined,
        },
      });
      setRemarks("");
      setShowWonModal(false);
      toast.success("Deal marked Won");
      celebrateCrm("deal.won", {
        amount: `₹${(Number(wonAmount) || estimated).toLocaleString("en-IN")}`,
      });
    } catch {
      toast.error("Failed to mark deal Won");
    } finally {
      setBusy(false);
    }
  };

  const handleLost = async () => {
    if (!lostReason) return;
    setBusy(true);
    try {
      await markLost.mutateAsync({
        id: opp.id,
        input: {
          reason: lostReason,
          reasonOther: lostOther || undefined,
          remarks: remarks || undefined,
          competitor:
            lostReason === "Competitor Selected"
              ? competitor || undefined
              : undefined,
        },
      });
      setShowLostPicker(false);
      setLostReason("");
      setLostOther("");
      setCompetitor("");
      setRemarks("");
      toast.success("Deal marked Lost");
      celebrateCrm("deal.lost");
    } catch {
      toast.error("Failed to mark deal Lost");
    } finally {
      setBusy(false);
    }
  };

  const openHoldModal = () => {
    setHoldReason(opp.holdReason ?? "");
    setHoldOther("");
    setExpectedResumeDate("");
    setHoldNotes("");
    setShowHoldModal(true);
  };

  const handleConfirmHold = async () => {
    if (!holdReason) return;
    setBusy(true);
    try {
      await setOnHold.mutateAsync({
        id: opp.id,
        input: {
          reason: holdReason,
          reasonOther:
            holdReason === "Other" ? holdOther || undefined : undefined,
          expectedResumeDate: expectedResumeDate || undefined,
          notes: holdNotes || undefined,
        },
      });
      setShowHoldModal(false);
      toast.success("Deal put On Hold");
      celebrateCrm("deal.onHold");
    } catch {
      toast.error("Failed to put deal On Hold");
    } finally {
      setBusy(false);
    }
  };

  /** Won/Lost opportunities sit on a structural stage; legacy reopened them into Negotiation. */
  const defaultReopenStageId = () => {
    if (boardStages.some((s) => s.id === opp.stageId)) return opp.stageId;
    return (
      boardStages.find((s) => s.code.toLowerCase() === "negotiation")?.id ??
      boardStages[0]?.id
    );
  };

  const handleReopen = async () => {
    const stageId = defaultReopenStageId();
    if (!stageId) return;
    setBusy(true);
    try {
      await reopen.mutateAsync({ id: opp.id, input: { stageId } });
      toast.success("Opportunity reopened");
      celebrateCrm("deal.reopened");
    } catch {
      toast.error("Failed to reopen opportunity");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmResume = async () => {
    if (!resumeStage) return;
    setBusy(true);
    try {
      await reopen.mutateAsync({
        id: opp.id,
        input: { stageId: Number(resumeStage) },
      });
      setShowResumeModal(false);
      toast.success(`Deal resumed into ${stageLabel(Number(resumeStage))}`);
      celebrateCrm("deal.reopened");
    } catch {
      toast.error("Failed to resume deal");
    } finally {
      setBusy(false);
    }
  };

  const handleStuckReason = async (reason: string) => {
    setStuckReason(reason);
    try {
      await setStuck.mutateAsync({ id: opp.id, input: { reason } });
    } catch {
      toast.error("Failed to save stuck reason");
    }
  };

  const daysInStage = daysSince(opp.stageEnteredAt);
  const daysSinceTouch = daysSince(opp.lastActivityAt);

  const bodyContent = (
    <div className={renderAs === "page" ? "space-y-5" : "mt-5 space-y-5"}>
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200/80 p-4 bg-slate-50/40">
        <Field icon={Target} label="Stage" value={opp.stage.label} />
        <Field icon={User} label="Owner" value={opp.ownerName} />
        <Field
          icon={IndianRupee}
          label="Estimated Value"
          value={estimated ? fmtIN(estimated) : "—"}
        />
        <Field
          icon={Calendar}
          label="Expected Close"
          value={opp.expectedCloseDate?.slice(0, 10) ?? "—"}
        />
        <Field
          icon={TrendingUp}
          label="Probability"
          value={probability ? `${probability}%` : "—"}
        />
        <Field
          icon={Clock3}
          label="Next Action"
          value={
            opp.nextAction
              ? `${opp.nextAction}${opp.nextActionDate ? ` (${opp.nextActionDate.slice(0, 10)})` : ""}`
              : "—"
          }
        />
        <Field
          icon={History}
          label="Days in Stage"
          value={daysInStage !== null ? `${daysInStage} days` : "—"}
        />
        <Field
          icon={Clock3}
          label="Days Since Last Touch"
          value={daysSinceTouch !== null ? `${daysSinceTouch} days` : "—"}
        />
      </div>

      {opp.status === "LOST" && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 text-sm text-red-700">
          <p className="font-bold">Lost reason: {opp.lostReason}</p>
          {opp.competitor && (
            <p className="mt-0.5">Lost to competitor: {opp.competitor}</p>
          )}
          {opp.lostReasonOther && (
            <p className="mt-0.5">{opp.lostReasonOther}</p>
          )}
        </div>
      )}

      {opp.status === "WON" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-emerald-700">
          <p className="font-bold">
            Closed Won — ₹{fmtIN(opp.closingAmount ?? opp.estimatedValue)}
          </p>
          {opp.closingDate && (
            <p className="mt-0.5">
              Closing date: {opp.closingDate.slice(0, 10)}
            </p>
          )}
          {opp.wonAt && (
            <p className="mt-0.5">
              Won on: {new Date(opp.wonAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {opp.status === "ON_HOLD" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-sm text-amber-700">
          <p className="font-bold">On Hold reason: {opp.holdReason || "—"}</p>
          {opp.holdReasonOther && (
            <p className="mt-0.5">{opp.holdReasonOther}</p>
          )}
          {opp.expectedResumeDate && (
            <p className="mt-0.5">
              Expected resume: {opp.expectedResumeDate.slice(0, 10)}
            </p>
          )}
          {opp.holdNotes && <p className="mt-0.5">{opp.holdNotes}</p>}
        </div>
      )}

      {opp.status === "OPEN" && health !== "Healthy" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
          <p className="text-sm font-bold text-amber-700">
            This opportunity looks {health.toLowerCase()} — why is it stuck?
          </p>
          <Select
            value={stuckReason}
            onValueChange={(v) => void handleStuckReason(v)}
          >
            <SelectTrigger className="h-9 rounded-xl bg-white">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {STUCK_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {opp.status === "OPEN" && !canManage && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-500">
          Only {opp.ownerName} or a Sales Head / CRM Admin can update this
          opportunity&apos;s stage.
        </div>
      )}

      {opp.status === "OPEN" && canManage && (
        <div className="space-y-2.5">
          <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Move Stage
          </Label>
          <div className="flex gap-2">
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boardStages.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="rounded-xl shrink-0"
              disabled={
                busy || Number(targetStage) === opp.stageId || !remarks.trim()
              }
              onClick={() => void handleMoveStage()}
            >
              Move
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500">
              Reason for this change <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why is this deal moving stage? e.g. Client confirmed budget and requested formal quotation."
              className="rounded-xl text-sm"
              rows={2}
            />
          </div>

          {!showLostPicker && !showWonModal && !showHoldModal ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={busy}
                onClick={openWonModal}
              >
                Mark Won
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                disabled={busy}
                onClick={() => setShowLostPicker(true)}
              >
                Mark Lost
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                disabled={busy}
                onClick={openHoldModal}
              >
                On Hold
              </Button>
            </div>
          ) : showLostPicker ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3.5 space-y-2.5">
              <Label className="text-xs font-bold text-red-700">
                Reason for loss *
              </Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger className="h-9 rounded-xl bg-white">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lostReason === "Competitor Selected" && (
                <Input
                  value={competitor}
                  onChange={(e) => setCompetitor(e.target.value)}
                  placeholder="Which competitor won this deal?"
                  className="rounded-xl text-sm bg-white h-9"
                />
              )}
              {lostReason === "Other" && (
                <Textarea
                  value={lostOther}
                  onChange={(e) => setLostOther(e.target.value)}
                  placeholder="Describe the reason…"
                  className="rounded-xl text-sm bg-white"
                  rows={2}
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={CANCEL_BTN}
                  onClick={() => setShowLostPicker(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl bg-red-600 hover:bg-red-700"
                  disabled={!lostReason || busy}
                  onClick={() => void handleLost()}
                >
                  Confirm Lost
                </Button>
              </div>
            </div>
          ) : showWonModal ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
              <Label className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> Confirm the final numbers to
                close this deal Won
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">
                    Final Amount *
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={wonAmount}
                    onChange={(e) => setWonAmount(e.target.value)}
                    className="rounded-xl bg-white h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">
                    Closing Date *
                  </Label>
                  <DatePicker
                    value={wonDate}
                    onChange={setWonDate}
                    className="bg-white h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">
                  Closing Notes (optional)
                </Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Any notes about how this deal closed…"
                  className="rounded-xl text-sm bg-white"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={CANCEL_BTN}
                  onClick={() => setShowWonModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  disabled={busy || !wonAmount || !wonDate}
                  onClick={() => void handleConfirmWon()}
                >
                  <Trophy className="h-3.5 w-3.5" />{" "}
                  {busy ? "Confirming…" : "Confirm Won"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2.5">
              <Label className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                <PauseCircle className="h-3.5 w-3.5" /> Put this deal on hold
              </Label>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">
                  Hold Reason *
                </Label>
                <Select value={holdReason} onValueChange={setHoldReason}>
                  <SelectTrigger className="h-9 rounded-xl bg-white">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLD_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {holdReason === "Other" && (
                <Textarea
                  value={holdOther}
                  onChange={(e) => setHoldOther(e.target.value)}
                  placeholder="Describe the reason…"
                  className="rounded-xl text-sm bg-white"
                  rows={2}
                />
              )}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">
                  Expected Resume Date (optional)
                </Label>
                <DatePicker
                  value={expectedResumeDate}
                  onChange={setExpectedResumeDate}
                  className="bg-white h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">
                  Notes (optional)
                </Label>
                <Textarea
                  value={holdNotes}
                  onChange={(e) => setHoldNotes(e.target.value)}
                  placeholder="Any context for the pause…"
                  className="rounded-xl text-sm bg-white"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={CANCEL_BTN}
                  onClick={() => setShowHoldModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 gap-1.5"
                  disabled={busy || !holdReason}
                  onClick={() => void handleConfirmHold()}
                >
                  <PauseCircle className="h-3.5 w-3.5" />{" "}
                  {busy ? "Saving…" : "Confirm On Hold"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {opp.status === "ON_HOLD" && canManage && !showResumeModal && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
          disabled={busy}
          onClick={() => setShowResumeModal(true)}
        >
          <PlayCircle className="h-3.5 w-3.5" /> Resume Deal
        </Button>
      )}

      {opp.status === "ON_HOLD" && canManage && showResumeModal && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
          <Label className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
            <PlayCircle className="h-3.5 w-3.5" /> Choose the stage to resume
            this deal into
          </Label>
          <Select value={resumeStage} onValueChange={setResumeStage}>
            <SelectTrigger className="h-9 rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boardStages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={CANCEL_BTN}
              onClick={() => setShowResumeModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              disabled={busy || !resumeStage}
              onClick={() => void handleConfirmResume()}
            >
              <PlayCircle className="h-3.5 w-3.5" />{" "}
              {busy ? "Resuming…" : "Confirm Resume"}
            </Button>
          </div>
        </div>
      )}

      {(opp.status === "WON" || opp.status === "LOST") && canManage && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() => void handleReopen()}
        >
          Reopen Opportunity
        </Button>
      )}

      <div>
        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5 mb-2">
          <History className="h-3.5 w-3.5" /> Stage History
        </Label>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">
            No stage changes recorded yet.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {history.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-slate-200/80 p-2.5 text-sm bg-white"
              >
                <p className="font-semibold text-slate-700">
                  {h.fromStage
                    ? `${h.fromStage.label} → ${h.toStage.label}`
                    : `Set to ${h.toStage.label}`}
                </p>
                <p className="text-slate-400 mt-0.5">
                  {new Date(h.changedAt).toLocaleString()}
                </p>
                {h.remarks && (
                  <p className="text-slate-500 mt-1">{h.remarks}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canDelete && (
        <div className="pt-2 border-t border-slate-100">
          <DeleteConfirmDialog
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Opportunity
              </Button>
            }
            title="Delete this opportunity?"
            description={`"${opp.title}" and its full stage history will be moved to the CRM Recycle Bin.`}
            warning={
              linkedTotal > 0
                ? `This opportunity has ${linked.activities} activit${linked.activities === 1 ? "y" : "ies"}, ${linked.meetings} meeting${linked.meetings === 1 ? "" : "s"}, ${linked.followUps} follow-up${linked.followUps === 1 ? "" : "s"}, and ${linked.quotations} quotation${linked.quotations === 1 ? "" : "s"} linked to it.`
                : undefined
            }
            onConfirm={async () => {
              await deleteOpportunity.mutateAsync(opp.id);
              toast.success("Opportunity deleted");
              onOpenChange(false);
              if (renderAs === "page") router.push("/crm/pipeline");
            }}
          />
        </div>
      )}
    </div>
  );

  const headerBadges = (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={cn("border", STATUS_STYLE[opp.status])}>
        {opp.status.replace("_", " ")}
      </Badge>
      {opp.status === "OPEN" && (
        <Badge className={cn("border", HEALTH_STYLE[health])}>{health}</Badge>
      )}
    </div>
  );

  if (renderAs === "page") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-2">
          {headerBadges}
          <h2 className="text-lg font-bold text-slate-900">{opp.title}</h2>
          {accountName && (
            <p className="text-sm text-slate-500">{accountName}</p>
          )}
        </div>
        {bodyContent}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left space-y-2">
          {headerBadges}
          <SheetTitle className="text-lg font-bold text-slate-900">
            {opp.title}
          </SheetTitle>
          {accountName && (
            <p className="text-sm text-slate-500">{accountName}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5 w-fit"
            onClick={() => {
              onOpenChange(false);
              router.push(`/crm/pipeline/${opp.id}`);
            }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Open Full Details
          </Button>
        </SheetHeader>

        {bodyContent}
      </SheetContent>
    </Sheet>
  );
}
