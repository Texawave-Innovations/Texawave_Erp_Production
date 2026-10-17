// CRM Core Domain — shared Opportunity detail drawer. Used by both the Account 360 page
// (Opportunities tab) and the Pipeline board, so stage-change / Won / Lost / On Hold logic lives
// in exactly one place.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm, celebrationKeyForStage } from "../celebration";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  HOLD_REASONS,
  LOST_REASONS,
  STUCK_REASONS,
  computeOpportunityHealth,
  daysSince,
} from "./config";
import {
  liveStageLabel as stageLabel,
  useCrmPipelineStages,
} from "./pipelineStagesService";
import { canManageOpportunity, isCrmAdmin } from "./roles";
import { DeleteConfirmDialog } from "../intelligence/components";
import { DatePicker } from "../components/DatePicker";
import {
  changeCrmOpportunityStage,
  deleteCrmOpportunityCascade,
  markCrmOpportunityLost,
  markCrmOpportunityWon,
  reopenCrmOpportunity,
  setCrmOpportunityOnHold,
  setCrmOpportunityStuckReason,
  subscribeCrmStageHistory,
  updateCrmOpportunity,
} from "./opportunitiesService";
import {
  CrmHoldReason,
  CrmLostReason,
  CrmOpportunity,
  CrmStageHistoryEntry,
  CrmStuckReason,
} from "./types";
import { useCrmDomainData } from "./useCrmDomainData";

const HEALTH_STYLE: Record<string, string> = {
  Healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Delayed: "bg-amber-50 text-amber-700 border-amber-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};

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

export function OpportunityDrawer({
  opportunity,
  accountName,
  open,
  onOpenChange,
  currentUser,
  renderAs = "sheet",
}: {
  opportunity: CrmOpportunity | null;
  accountName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
  /** 'sheet' (default, unchanged) renders as a slide-in side panel — used by the Pipeline board's
   *  quick-view and any other existing caller. 'page' renders the exact same content inline, with
   *  no Sheet wrapper/overlay — used by DealDetail.tsx's "Manage Stage / Won / Lost" action so it
   *  appears on the same page instead of a modal. */
  renderAs?: "sheet" | "page";
}) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CrmStageHistoryEntry[]>([]);
  const [targetStage, setTargetStage] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lostReason, setLostReason] = useState<CrmLostReason | "">("");
  const [lostOther, setLostOther] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [showLostPicker, setShowLostPicker] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [wonAmount, setWonAmount] = useState("");
  const [wonDate, setWonDate] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState<CrmHoldReason | "">("");
  const [holdOther, setHoldOther] = useState("");
  const [expectedResumeDate, setExpectedResumeDate] = useState("");
  const [holdNotes, setHoldNotes] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeStage, setResumeStage] = useState("");
  const [stuckReason, setStuckReason] = useState<CrmStuckReason | "">("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const canManage = canManageOpportunity(user, opportunity?.ownerName);
  const { boardStages, stages } = useCrmPipelineStages();
  const { activities, meetings, followUps, quotations } = useCrmDomainData();

  useEffect(() => {
    if (!opportunity) return undefined;
    setTargetStage(opportunity.stage);
    setResumeStage(opportunity.stage);
    setStuckReason(opportunity.stuckReason || "");
    return subscribeCrmStageHistory(opportunity.id, setHistory);
  }, [opportunity?.id]);

  const slaDays = opportunity
    ? stages.find((s) => s.id === opportunity.stage)?.slaDays
    : undefined;
  const health = useMemo(
    () =>
      opportunity
        ? computeOpportunityHealth(
            opportunity.stageEnteredAt,
            opportunity.status,
            slaDays,
          )
        : "Healthy",
    [opportunity?.stageEnteredAt, opportunity?.status, slaDays],
  );

  const linkedActivities = useMemo(
    () =>
      opportunity
        ? activities.filter((a) => a.relatedId === opportunity.id)
        : [],
    [activities, opportunity?.id],
  );
  const linkedMeetings = useMemo(
    () =>
      opportunity ? meetings.filter((m) => m.relatedId === opportunity.id) : [],
    [meetings, opportunity?.id],
  );
  const linkedFollowUps = useMemo(
    () =>
      opportunity
        ? followUps.filter((f) => f.relatedId === opportunity.id)
        : [],
    [followUps, opportunity?.id],
  );
  const linkedQuotations = useMemo(
    () =>
      opportunity
        ? quotations.filter((q) => q.opportunityId === opportunity.id)
        : [],
    [quotations, opportunity?.id],
  );
  const linkedCounts = useMemo(
    () => ({
      activities: linkedActivities.length,
      meetings: linkedMeetings.length,
      followUps: linkedFollowUps.length,
      quotations: linkedQuotations.length,
      total:
        linkedActivities.length +
        linkedMeetings.length +
        linkedFollowUps.length +
        linkedQuotations.length,
    }),
    [linkedActivities, linkedMeetings, linkedFollowUps, linkedQuotations],
  );

  if (!opportunity) return null;

  const handleMoveStage = async () => {
    if (!targetStage || targetStage === opportunity.stage || !remarks.trim())
      return;
    setBusy(true);
    try {
      await changeCrmOpportunityStage(
        opportunity,
        targetStage,
        currentUser,
        remarks.trim(),
      );
      setRemarks("");
      toast.success(`Moved to ${stageLabel(targetStage)}`);
      celebrateCrm(celebrationKeyForStage(targetStage));
    } catch (err) {
      console.error("Failed to change opportunity stage:", err);
      toast.error("Failed to change stage");
    } finally {
      setBusy(false);
    }
  };

  const openWonModal = () => {
    setWonAmount(String(opportunity.estimatedValue || 0));
    setWonDate(
      opportunity.expectedCloseDate || new Date().toISOString().slice(0, 10),
    );
    setShowWonModal(true);
  };

  const handleConfirmWon = async () => {
    setBusy(true);
    try {
      await markCrmOpportunityWon(opportunity.id, currentUser, {
        closingAmount: Number(wonAmount) || opportunity.estimatedValue,
        closingDate: wonDate || undefined,
        remarks: remarks || undefined,
        fromStage: opportunity.stage,
      });
      setRemarks("");
      setShowWonModal(false);
      toast.success("Deal marked Won");
      celebrateCrm("deal.won", {
        amount: `₹${(Number(wonAmount) || opportunity.estimatedValue).toLocaleString("en-IN")}`,
      });
    } catch (err) {
      console.error("Failed to mark opportunity Won:", err);
      toast.error("Failed to mark deal Won");
    } finally {
      setBusy(false);
    }
  };

  const handleLost = async () => {
    if (!lostReason) return;
    setBusy(true);
    try {
      await markCrmOpportunityLost(
        opportunity.id,
        lostReason,
        currentUser,
        lostOther || undefined,
        remarks || undefined,
        lostReason === "Competitor Selected"
          ? competitor || undefined
          : undefined,
        opportunity.stage,
      );
      setShowLostPicker(false);
      setLostReason("");
      setLostOther("");
      setCompetitor("");
      setRemarks("");
      toast.success("Deal marked Lost");
      celebrateCrm("deal.lost");
    } catch (err) {
      console.error("Failed to mark opportunity Lost:", err);
      toast.error("Failed to mark deal Lost");
    } finally {
      setBusy(false);
    }
  };

  const openHoldModal = () => {
    setHoldReason(opportunity.holdReason || "");
    setHoldOther("");
    setExpectedResumeDate("");
    setHoldNotes("");
    setShowHoldModal(true);
  };

  const handleConfirmHold = async () => {
    if (!holdReason) return;
    setBusy(true);
    try {
      await setCrmOpportunityOnHold(opportunity.id, holdReason, currentUser, {
        reasonOther:
          holdReason === "Other" ? holdOther || undefined : undefined,
        expectedResumeDate: expectedResumeDate || undefined,
        notes: holdNotes || undefined,
        fromStage: opportunity.stage,
      });
      setShowHoldModal(false);
      toast.success("Deal put On Hold");
      celebrateCrm("deal.onHold");
    } catch (err) {
      console.error("Failed to put opportunity On Hold:", err);
      toast.error("Failed to put deal On Hold");
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await reopenCrmOpportunity(
        opportunity.id,
        opportunity.stage === "won" || opportunity.stage === "lost"
          ? "negotiation"
          : opportunity.stage,
        currentUser,
        opportunity.stage,
      );
      toast.success("Opportunity reopened");
      celebrateCrm("deal.reopened");
    } catch (err) {
      console.error("Failed to reopen opportunity:", err);
      toast.error("Failed to reopen opportunity");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmResume = async () => {
    if (!resumeStage) return;
    setBusy(true);
    try {
      await reopenCrmOpportunity(
        opportunity.id,
        resumeStage,
        currentUser,
        opportunity.stage,
      );
      setShowResumeModal(false);
      toast.success(`Deal resumed into ${stageLabel(resumeStage)}`);
      celebrateCrm("deal.reopened");
    } catch (err) {
      console.error("Failed to resume opportunity:", err);
      toast.error("Failed to resume deal");
    } finally {
      setBusy(false);
    }
  };

  const handleStuckReason = async (reason: CrmStuckReason) => {
    setStuckReason(reason);
    try {
      await setCrmOpportunityStuckReason(opportunity.id, reason);
    } catch (err) {
      console.error("Failed to set stuck reason:", err);
      toast.error("Failed to save stuck reason");
    }
  };

  const handleForecastCategoryChange = async (
    category: CrmOpportunity["forecastCategory"],
  ) => {
    try {
      await updateCrmOpportunity(
        opportunity.id,
        { forecastCategory: category },
        currentUser,
      );
      toast.success("Forecast category updated");
    } catch (err) {
      console.error("Failed to update forecast category:", err);
      toast.error("Failed to update forecast category");
    }
  };

  const bodyContent = (
    <>
      <div className={renderAs === "page" ? "space-y-5" : "mt-5 space-y-5"}>
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200/80 p-4 bg-slate-50/40">
          <Field
            icon={Target}
            label="Stage"
            value={stageLabel(opportunity.stage)}
          />
          <Field icon={User} label="Owner" value={opportunity.ownerName} />
          <Field
            icon={IndianRupee}
            label="Estimated Value"
            value={
              opportunity.estimatedValue
                ? opportunity.estimatedValue.toLocaleString("en-IN")
                : "—"
            }
          />
          <Field
            icon={Calendar}
            label="Expected Close"
            value={opportunity.expectedCloseDate || "—"}
          />
          <Field
            icon={TrendingUp}
            label="Probability"
            value={
              opportunity.probability ? `${opportunity.probability}%` : "—"
            }
          />
          <Field
            icon={Clock3}
            label="Next Action"
            value={
              opportunity.nextAction
                ? `${opportunity.nextAction}${opportunity.nextActionDate ? ` (${opportunity.nextActionDate})` : ""}`
                : "—"
            }
          />
          <Field
            icon={History}
            label="Days in Stage"
            value={
              daysSince(opportunity.stageEnteredAt) !== null
                ? `${daysSince(opportunity.stageEnteredAt)} days`
                : "—"
            }
          />
          <Field
            icon={Clock3}
            label="Days Since Last Touch"
            value={
              daysSince(opportunity.lastActivityAt) !== null
                ? `${daysSince(opportunity.lastActivityAt)} days`
                : "—"
            }
          />
        </div>

        {opportunity.status === "OPEN" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Forecast Category
            </Label>
            <Select
              value={opportunity.forecastCategory || ""}
              onValueChange={(v) =>
                handleForecastCategoryChange(
                  v as CrmOpportunity["forecastCategory"],
                )
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue placeholder="Not categorized" />
              </SelectTrigger>
              <SelectContent>
                {(["Best Case", "Commit", "Pipeline", "Omitted"] as const).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {opportunity.status === "LOST" && (
          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 text-sm text-red-700">
            <p className="font-bold">Lost reason: {opportunity.lostReason}</p>
            {opportunity.competitor && (
              <p className="mt-0.5">
                Lost to competitor: {opportunity.competitor}
              </p>
            )}
            {opportunity.lostReasonOther && (
              <p className="mt-0.5">{opportunity.lostReasonOther}</p>
            )}
          </div>
        )}

        {opportunity.status === "WON" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-emerald-700">
            <p className="font-bold">
              Closed Won — ₹
              {(
                opportunity.closingAmount ?? opportunity.estimatedValue
              ).toLocaleString("en-IN")}
            </p>
            {opportunity.closingDate && (
              <p className="mt-0.5">Closing date: {opportunity.closingDate}</p>
            )}
            {opportunity.wonAt && (
              <p className="mt-0.5">
                Won on: {new Date(opportunity.wonAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {opportunity.status === "ON_HOLD" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-sm text-amber-700">
            <p className="font-bold">
              On Hold reason: {opportunity.holdReason || "—"}
            </p>
            {opportunity.holdReasonOther && (
              <p className="mt-0.5">{opportunity.holdReasonOther}</p>
            )}
            {opportunity.expectedResumeDate && (
              <p className="mt-0.5">
                Expected resume: {opportunity.expectedResumeDate}
              </p>
            )}
            {opportunity.holdNotes && (
              <p className="mt-0.5">{opportunity.holdNotes}</p>
            )}
          </div>
        )}

        {opportunity.status === "OPEN" && health !== "Healthy" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
            <p className="text-sm font-bold text-amber-700">
              This opportunity looks {health.toLowerCase()} — why is it stuck?
            </p>
            <Select
              value={stuckReason}
              onValueChange={(v) => handleStuckReason(v as CrmStuckReason)}
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

        {opportunity.status === "OPEN" && !canManage && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-500">
            Only {opportunity.ownerName} or a Sales Head / CRM Admin can update
            this opportunity's stage.
          </div>
        )}

        {opportunity.status === "OPEN" && canManage && (
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
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="rounded-xl shrink-0"
                disabled={
                  busy || targetStage === opportunity.stage || !remarks.trim()
                }
                onClick={handleMoveStage}
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
                <Select
                  value={lostReason}
                  onValueChange={(v) => setLostReason(v as CrmLostReason)}
                >
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
                    className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                    onClick={() => setShowLostPicker(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl bg-red-600 hover:bg-red-700"
                    disabled={!lostReason || busy}
                    onClick={handleLost}
                  >
                    Confirm Lost
                  </Button>
                </div>
              </div>
            ) : showWonModal ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
                <Label className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" /> Confirm the final numbers
                  to close this deal Won
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
                    className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                    onClick={() => setShowWonModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                    disabled={busy || !wonAmount || !wonDate}
                    onClick={handleConfirmWon}
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
                  <Select
                    value={holdReason}
                    onValueChange={(v) => setHoldReason(v as CrmHoldReason)}
                  >
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
                    className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                    onClick={() => setShowHoldModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 gap-1.5"
                    disabled={busy || !holdReason}
                    onClick={handleConfirmHold}
                  >
                    <PauseCircle className="h-3.5 w-3.5" />{" "}
                    {busy ? "Saving…" : "Confirm On Hold"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {opportunity.status === "ON_HOLD" && canManage && !showResumeModal && (
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

        {opportunity.status === "ON_HOLD" && canManage && showResumeModal && (
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
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                onClick={() => setShowResumeModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                disabled={busy || !resumeStage}
                onClick={handleConfirmResume}
              >
                <PlayCircle className="h-3.5 w-3.5" />{" "}
                {busy ? "Resuming…" : "Confirm Resume"}
              </Button>
            </div>
          </div>
        )}

        {(opportunity.status === "WON" || opportunity.status === "LOST") &&
          canManage && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={busy}
              onClick={handleReopen}
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
                      ? `${stageLabel(h.fromStage)} → ${stageLabel(h.toStage)}`
                      : `Set to ${stageLabel(h.toStage)}`}
                  </p>
                  <p className="text-slate-400 mt-0.5">
                    {new Date(h.changedAt).toLocaleString()} · {h.changedBy}
                  </p>
                  {h.remarks && (
                    <p className="text-slate-500 mt-1">{h.remarks}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isCrmAdmin(user) && (
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
              description={`"${opportunity.title}" and its full stage history will be moved to the CRM Recycle Bin.`}
              warning={
                linkedCounts.total > 0
                  ? `This will also move ${linkedCounts.activities} activit${linkedCounts.activities === 1 ? "y" : "ies"}, ${linkedCounts.meetings} meeting${linkedCounts.meetings === 1 ? "" : "s"}, ${linkedCounts.followUps} follow-up${linkedCounts.followUps === 1 ? "" : "s"}, and ${linkedCounts.quotations} quotation${linkedCounts.quotations === 1 ? "" : "s"} linked to it.`
                  : undefined
              }
              onConfirm={async () => {
                await deleteCrmOpportunityCascade(
                  { id: opportunity.id, title: opportunity.title },
                  {
                    activityIds: linkedActivities.map((a) => a.id),
                    meetingIds: linkedMeetings.map((m) => m.id),
                    followUpIds: linkedFollowUps.map((f) => f.id),
                    quotationIds: linkedQuotations.map((q) => q.id),
                  },
                  user,
                );
                onOpenChange(false);
              }}
            />
          </div>
        )}
      </div>
    </>
  );

  if (renderAs === "page") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", STATUS_STYLE[opportunity.status])}>
              {opportunity.status.replace("_", " ")}
            </Badge>
            {opportunity.status === "OPEN" && (
              <Badge className={cn("border", HEALTH_STYLE[health])}>
                {health}
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {opportunity.title}
          </h2>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", STATUS_STYLE[opportunity.status])}>
              {opportunity.status.replace("_", " ")}
            </Badge>
            {opportunity.status === "OPEN" && (
              <Badge className={cn("border", HEALTH_STYLE[health])}>
                {health}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg font-bold text-slate-900">
            {opportunity.title}
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
              navigate(`/crm/pipeline/${opportunity.id}`);
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
