"use client";

// Sales Pipeline (legacy `Pipeline.tsx`): a cross-account Kanban board over every open
// Opportunity grouped by stage, a sortable List view, status filters (Open / Won / Lost /
// On Hold), KPI cards, native HTML5 drag-and-drop between stage columns (always confirmed with a
// required reason) and the shared quick-view `OpportunityDrawer`.
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/legacy-ui/tabs";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import {
  celebrateCrm,
  celebrationKeyForStage,
} from "@/features/crm/celebration";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import type {
  Opportunity,
  OpportunityStatus,
  PipelineStage,
} from "@texawave-erp/api-types";
import { ApiError, type CreateOpportunityFormValues } from "@texawave-erp/core";
import {
  AlertTriangle,
  ArrowUpDown,
  Briefcase,
  IndianRupee,
  LayoutGrid,
  List,
  PauseCircle,
  Plus,
  Search,
  Settings2,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PipelineStageSettingsDialog } from "../../pipeline-stages/components/PipelineStageSettingsDialog";
import { usePipelineStages } from "../../pipeline-stages/hooks";
import {
  useAllOpportunities,
  useChangeOpportunityStage,
  useCreateOpportunity,
  useOpportunities,
} from "../hooks";
import {
  HEALTH_DOT,
  OPPORTUNITY_WRITE_PERMS,
  computeExpectedRevenue,
  computeOpportunityHealth,
  currencySymbol,
  daysSince,
  fmtIN,
  formatMultiCurrencyTotal,
  num,
  stageBorderFor,
  stageColorFor,
} from "../pipelineConfig";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { OpportunityForm } from "./OpportunityForm";

/** Soft, neutral-grey panel shadow shared by every Kanban column / status container. */
const PANEL_GREY_SHADOW = "shadow-[0_2px_10px_-2px_rgba(100,116,139,0.18)]";

type SortKey =
  "title" | "estimatedValue" | "expectedCloseDate" | "createdAt" | "ownerName";

const KPI_TONE = {
  blue: {
    card: "from-blue-50/80 to-white",
    icon: "bg-blue-100 text-blue-600 border-blue-200",
  },
  brand: {
    card: "from-brand-50/80 to-white",
    icon: "bg-brand-100 text-brand-700 border-brand-200",
  },
  emerald: {
    card: "from-emerald-50/80 to-white",
    icon: "bg-emerald-100 text-emerald-600 border-emerald-200",
  },
  red: {
    card: "from-red-50/80 to-white",
    icon: "bg-red-100 text-red-600 border-red-200",
  },
} as const;

function PipelineKpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: keyof typeof KPI_TONE;
}) {
  const t = KPI_TONE[tone];
  return (
    <div
      className={cn(
        "crm-panel-frame flex items-center gap-3 rounded-2xl bg-gradient-to-br p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
        t.card,
      )}
    >
      <span
        className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center border shrink-0",
          t.icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-none">
          {value}
        </p>
        <p className="text-sm text-slate-500 mt-1 font-medium truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

const STATUS_META: Record<
  OpportunityStatus,
  {
    label: string;
    icon: LucideIcon;
    filterActive: string;
    filterOutline: string;
    countBadgeActive: string;
    countBadgeOutline: string;
    cardAccent: string;
    badge: string;
    emptyTitle: string;
    emptyDescription?: string;
  }
> = {
  OPEN: {
    label: "Open",
    icon: Target,
    filterActive: "bg-blue-600 text-white border-blue-600 shadow-sm",
    filterOutline:
      "bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:-translate-y-0.5",
    countBadgeActive: "bg-white/25 text-white",
    countBadgeOutline: "bg-blue-100 text-blue-700",
    cardAccent: "border-l-4 border-l-blue-300",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    emptyTitle: "No active opportunities.",
  },
  WON: {
    label: "Won",
    icon: Trophy,
    filterActive: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    filterOutline:
      "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:-translate-y-0.5",
    countBadgeActive: "bg-white/25 text-white",
    countBadgeOutline: "bg-emerald-100 text-emerald-700",
    cardAccent: "border-l-4 border-l-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    emptyTitle: "No won deals yet.",
    emptyDescription: "Close your first opportunity to see it here.",
  },
  LOST: {
    label: "Lost",
    icon: XCircle,
    filterActive: "bg-red-600 text-white border-red-600 shadow-sm",
    filterOutline:
      "bg-white border-red-200 text-red-700 hover:bg-red-50 hover:-translate-y-0.5",
    countBadgeActive: "bg-white/25 text-white",
    countBadgeOutline: "bg-red-100 text-red-700",
    cardAccent: "border-l-4 border-l-red-400",
    badge: "bg-red-50 text-red-700 border-red-200",
    emptyTitle: "No lost deals.",
  },
  ON_HOLD: {
    label: "On Hold",
    icon: PauseCircle,
    filterActive: "bg-amber-600 text-white border-amber-600 shadow-sm",
    filterOutline:
      "bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:-translate-y-0.5",
    countBadgeActive: "bg-white/25 text-white",
    countBadgeOutline: "bg-amber-100 text-amber-700",
    cardAccent: "border-l-4 border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    emptyTitle: "No deals are currently on hold.",
  },
};

const TH = "font-black text-sm uppercase tracking-wider text-white py-2.5";

export function PipelineBoard() {
  const router = useRouter();
  const canConfigure = usePermission("crm.pipeline_stage.write");
  const canCreate = usePermission(OPPORTUNITY_WRITE_PERMS);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus>("OPEN");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [active, setActive] = useState<Opportunity | null>(null);
  const [dragOverStage, setDragOverStage] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const stagesQuery = usePipelineStages();
  const stages = useMemo(() => stagesQuery.data ?? [], [stagesQuery.data]);
  const boardStages = useMemo(
    () =>
      stages
        .filter((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold)
        .sort((a, b) => a.order - b.order),
    [stages],
  );
  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const openQuery = useAllOpportunities("OPEN");
  const statusListQuery = useAllOpportunities(statusFilter);
  const wonCount = useOpportunities({ status: "WON", limit: 1 });
  const lostCount = useOpportunities({ status: "LOST", limit: 1 });
  const holdCount = useOpportunities({ status: "ON_HOLD", limit: 1 });

  const changeStage = useChangeOpportunityStage();
  const createMutation = useCreateOpportunity();

  const openOpps = useMemo(() => openQuery.data ?? [], [openQuery.data]);
  const statusOpps = useMemo(
    () => statusListQuery.data ?? [],
    [statusListQuery.data],
  );

  const dealAmount = (o: Opportunity) =>
    o.status === "WON"
      ? num(o.closingAmount ?? o.estimatedValue)
      : num(o.estimatedValue);
  const dealClosingDate = (o: Opportunity) =>
    o.status === "WON"
      ? (o.closingDate ?? o.expectedCloseDate)?.slice(0, 10) || "—"
      : o.expectedCloseDate?.slice(0, 10) || "—";
  const statusDetail = (o: Opportunity): string => {
    if (o.status === "WON")
      return o.wonAt ? `Won ${new Date(o.wonAt).toLocaleDateString()}` : "—";
    if (o.status === "LOST")
      return o.lostReason
        ? `${o.lostReason}${o.competitor ? ` (${o.competitor})` : ""}`
        : "—";
    if (o.status === "ON_HOLD")
      return o.holdReason
        ? `${o.holdReason}${o.expectedResumeDate ? ` · resume ${o.expectedResumeDate.slice(0, 10)}` : ""}`
        : "—";
    return "—";
  };
  const probabilityOf = (o: Opportunity) =>
    o.probability ?? stageById.get(o.stageId)?.probability ?? undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return statusOpps.filter((o) => {
      if (!q) return true;
      return [o.title, o.account.name, o.ownerName].some((f) =>
        (f || "").toLowerCase().includes(q),
      );
    });
  }, [statusOpps, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "ownerName")
        cmp = a.ownerName.localeCompare(b.ownerName);
      else if (sortKey === "estimatedValue")
        cmp = num(a.estimatedValue) - num(b.estimatedValue);
      else if (sortKey === "expectedCloseDate")
        cmp = (a.expectedCloseDate ?? "").localeCompare(
          b.expectedCloseDate ?? "",
        );
      else
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const byStage = useMemo(() => {
    const map = new Map<number, Opportunity[]>();
    boardStages.forEach((s) => map.set(s.id, []));
    filtered.forEach((o) => {
      const list = map.get(o.stageId);
      if (list) list.push(o);
      else map.set(o.stageId, [o]);
    });
    return map;
  }, [filtered, boardStages]);

  const totals = useMemo(
    () => ({
      openCount: openOpps.length,
      openValueDisplay: formatMultiCurrencyTotal(
        openOpps.map((o) => ({
          amount: num(o.estimatedValue),
          currency: o.currency,
        })),
      ),
      stuckCount: openOpps.filter(
        (o) =>
          computeOpportunityHealth(
            o.stageEnteredAt,
            o.status,
            stageById.get(o.stageId)?.slaDays,
          ) !== "Healthy",
      ).length,
    }),
    [openOpps, stageById],
  );

  const statusCounts: Record<OpportunityStatus, number> = {
    OPEN: totals.openCount,
    WON: wonCount.data?.meta.total ?? 0,
    LOST: lostCount.data?.meta.total ?? 0,
    ON_HOLD: holdCount.data?.meta.total ?? 0,
  };

  // Dragging a card onto a new column collects the stage-change reason first — every stage
  // change needs a reason, drag-and-drop is just a second entry point into the same rule.
  const [pendingMove, setPendingMove] = useState<{
    opportunity: Opportunity;
    target: PipelineStage;
  } | null>(null);
  const [moveRemarks, setMoveRemarks] = useState("");
  const [movingBusy, setMovingBusy] = useState(false);

  const handleDrop = (stage: PipelineStage, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
    const oppId = Number(e.dataTransfer.getData("text/plain"));
    const opp = openOpps.find((o) => o.id === oppId);
    if (!opp || opp.stageId === stage.id) return;
    setMoveRemarks("");
    setPendingMove({ opportunity: opp, target: stage });
  };

  const confirmPendingMove = async () => {
    if (!pendingMove || !moveRemarks.trim()) return;
    setMovingBusy(true);
    try {
      await changeStage.mutateAsync({
        id: pendingMove.opportunity.id,
        input: {
          stageId: pendingMove.target.id,
          remarks: moveRemarks.trim(),
        },
      });
      toast.success(`Moved to ${pendingMove.target.label}`);
      celebrateCrm(
        celebrationKeyForStage(
          pendingMove.target.code || pendingMove.target.label,
        ),
      );
      setPendingMove(null);
    } catch {
      toast.error("Failed to move opportunity");
    } finally {
      setMovingBusy(false);
    }
  };

  async function handleCreate(values: CreateOpportunityFormValues) {
    await createMutation.mutateAsync(values);
    toast.success("Deal created");
    celebrateCrm("deal.created");
    setCreateOpen(false);
  }

  const activeMeta = STATUS_META[statusFilter];
  const loading =
    stagesQuery.isPending || openQuery.isPending || statusListQuery.isPending;
  const loadError =
    stagesQuery.error ?? openQuery.error ?? statusListQuery.error;

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <div className="crm-panel-frame flex items-center justify-between gap-3 flex-wrap rounded-3xl bg-gradient-to-r from-brand-50/70 via-white to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Deals / Sales Pipeline
            </h2>
            <p className="text-sm text-slate-500">
              Drag a card to move it to a new stage, switch to List view to sort
              and scan, or click any deal for full details.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "kanban" | "list")}
          >
            <TabsList className="rounded-xl h-9 p-1">
              <TabsTrigger
                value="kanban"
                className="rounded-lg gap-1.5 text-xs"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="rounded-lg gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" /> List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals…"
              className="pl-8 h-9 rounded-xl w-64 bg-white border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
            />
          </div>
          <ImportExportBar
            entity="opportunities"
            moduleLabel="Deals"
            fileBaseName="crm-deals"
            search={query.trim() || undefined}
          />
          {canCreate && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add Deal
            </Button>
          )}
          {canConfigure && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 shrink-0 bg-white"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" /> Configure Stages
            </Button>
          )}
        </div>
      </div>

      {pendingMove && (
        <div className="rounded-3xl border border-brand-200 bg-brand-50/50 shadow-xl p-5 space-y-3">
          <p className="text-sm text-slate-700">
            Moving{" "}
            <span className="font-bold text-slate-800">
              &quot;{pendingMove.opportunity.title}&quot;
            </span>{" "}
            from{" "}
            <span className="font-bold">
              {pendingMove.opportunity.stage.label}
            </span>{" "}
            to <span className="font-bold">{pendingMove.target.label}</span>.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Reason for this change <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={moveRemarks}
              onChange={(e) => setMoveRemarks(e.target.value)}
              placeholder="Why is this deal moving stage?"
              className="rounded-xl text-sm bg-white"
              rows={2}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={() => setPendingMove(null)}
              disabled={movingBusy}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={!moveRemarks.trim() || movingBusy}
              onClick={() => void confirmPendingMove()}
            >
              {movingBusy ? "Moving…" : "Confirm Move"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PipelineKpiCard
          icon={Target}
          label="Open Opportunities"
          value={totals.openCount}
          tone="blue"
        />
        <PipelineKpiCard
          icon={IndianRupee}
          label="Open Pipeline Value"
          value={totals.openValueDisplay}
          tone="brand"
        />
        <PipelineKpiCard
          icon={TrendingUp}
          label="Won"
          value={statusCounts.WON}
          tone="emerald"
        />
        <PipelineKpiCard
          icon={AlertTriangle}
          label="Stuck"
          value={totals.stuckCount}
          tone="red"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(STATUS_META) as OpportunityStatus[]).map((s) => {
          const meta = STATUS_META[s];
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 h-9 text-xs font-bold border transition-all duration-200",
                isActive ? meta.filterActive : meta.filterOutline,
              )}
            >
              {meta.label}
              <span
                className={cn(
                  "rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-xs font-semibold leading-none",
                  isActive ? meta.countBadgeActive : meta.countBadgeOutline,
                )}
              >
                {statusCounts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Loading Pipeline…
        </div>
      ) : loadError ? (
        loadError instanceof ApiError && loadError.isPermissionError ? (
          <EmptyState
            icon={Briefcase}
            title="You don't have access to the Pipeline"
            description="Ask an administrator for the crm.opportunity.read permission."
          />
        ) : (
          <EmptyState icon={Briefcase} title="Could not load the pipeline." />
        )
      ) : view === "list" ? (
        sorted.length === 0 ? (
          <EmptyState
            icon={activeMeta.icon}
            title={activeMeta.emptyTitle}
            description={activeMeta.emptyDescription}
          />
        ) : (
          <div className="crm-panel-frame rounded-3xl bg-white overflow-x-auto crm-tracker-scroll">
            <Table>
              <TableHeader
                style={{
                  background:
                    "linear-gradient(135deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                }}
                className="text-white"
              >
                <TableRow className="hover:bg-transparent border-none">
                  {(
                    [
                      ["title", "Deal Name"],
                      [
                        "estimatedValue",
                        statusFilter === "WON" ? "Final Amount" : "Amount",
                      ],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <TableHead
                      key={key}
                      className={cn(TH, "cursor-pointer select-none")}
                      onClick={() => toggleSort(key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label} <ArrowUpDown className="h-3 w-3 opacity-70" />
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className={TH}>Stage</TableHead>
                  <TableHead className={TH}>Probability</TableHead>
                  <TableHead className={TH}>Expected Revenue</TableHead>
                  <TableHead
                    className={cn(TH, "cursor-pointer select-none")}
                    onClick={() => toggleSort("expectedCloseDate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {statusFilter === "WON"
                        ? "Closing Date"
                        : "Expected Close"}{" "}
                      <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </span>
                  </TableHead>
                  <TableHead className={TH}>Account</TableHead>
                  <TableHead className={TH}>Contact</TableHead>
                  <TableHead
                    className={cn(TH, "cursor-pointer select-none")}
                    onClick={() => toggleSort("ownerName")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Owner <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </span>
                  </TableHead>
                  {statusFilter !== "OPEN" && (
                    <TableHead className={TH}>
                      {statusFilter === "WON"
                        ? "Won Detail"
                        : statusFilter === "LOST"
                          ? "Lost Reason"
                          : "Hold Detail"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((o) => {
                  const prob = probabilityOf(o);
                  const sym = currencySymbol(o.currency);
                  return (
                    <TableRow
                      key={o.id}
                      className={cn(
                        "border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40",
                        o.status === "WON" && "bg-emerald-50/30",
                        o.status === "LOST" && "bg-red-50/30",
                        o.status === "ON_HOLD" && "bg-amber-50/30",
                      )}
                      onClick={() => router.push(`/crm/pipeline/${o.id}`)}
                    >
                      <TableCell className="py-1">
                        <p className="font-semibold text-slate-800">
                          {o.title}
                        </p>
                        {o.opportunityNumber && (
                          <p className="text-sm text-slate-400">
                            {o.opportunityNumber}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-base font-semibold text-slate-700">
                        {sym}
                        {dealAmount(o).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-xs">
                          {o.stage.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {prob !== undefined ? `${prob}%` : "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {sym}
                        {computeExpectedRevenue(
                          num(o.estimatedValue),
                          prob,
                        ).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {dealClosingDate(o)}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {o.account.name}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {o.contact?.name ?? "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {o.ownerName}
                      </TableCell>
                      {statusFilter !== "OPEN" && (
                        <TableCell className="py-1 text-base text-slate-600">
                          {statusDetail(o)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : statusFilter !== "OPEN" ? (
        filtered.length === 0 ? (
          <EmptyState
            icon={activeMeta.icon}
            title={activeMeta.emptyTitle}
            description={activeMeta.emptyDescription}
          />
        ) : (
          <div className="crm-panel-frame rounded-2xl bg-white p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((o) => {
                const sym = currencySymbol(o.currency);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => router.push(`/crm/pipeline/${o.id}`)}
                    className={cn(
                      "crm-panel-frame text-left rounded-2xl bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                      activeMeta.cardAccent,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 leading-snug">
                        {o.title}
                      </p>
                      <Badge
                        className={cn(
                          "text-xs border shrink-0",
                          activeMeta.badge,
                        )}
                      >
                        {activeMeta.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 truncate">
                      {o.account.name}
                    </p>
                    {o.contact && (
                      <p className="text-sm text-slate-400 mt-0.5 truncate">
                        {o.contact.name}
                      </p>
                    )}

                    {o.status === "WON" && (
                      <div className="mt-2.5 space-y-0.5 text-sm">
                        <p className="font-bold text-emerald-700">
                          {sym}
                          {fmtIN(o.closingAmount ?? o.estimatedValue)}
                        </p>
                        {o.closingDate && (
                          <p className="text-slate-500">
                            Closed: {o.closingDate.slice(0, 10)}
                          </p>
                        )}
                        {o.wonAt && (
                          <p className="text-slate-400">
                            Won on {new Date(o.wonAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {o.status === "LOST" && (
                      <div className="mt-2.5 space-y-0.5 text-sm">
                        {o.lostReason && (
                          <p className="font-bold text-red-700">
                            {o.lostReason}
                          </p>
                        )}
                        {o.competitor && (
                          <p className="text-slate-500">
                            Lost to: {o.competitor}
                          </p>
                        )}
                      </div>
                    )}

                    {o.status === "ON_HOLD" && (
                      <div className="mt-2.5 space-y-0.5 text-sm">
                        {o.holdReason && (
                          <p className="font-bold text-amber-700">
                            {o.holdReason}
                          </p>
                        )}
                        {o.expectedResumeDate && (
                          <p className="text-slate-500">
                            Resume by: {o.expectedResumeDate.slice(0, 10)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                      <span className="text-sm text-slate-500 font-medium truncate">
                        {o.ownerName}
                      </span>
                      <span className="text-sm font-semibold text-slate-600 shrink-0">
                        {sym}
                        {fmtIN(o.estimatedValue)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="overflow-x-auto crm-tracker-scroll pb-2">
          <div className="flex gap-3 min-w-max">
            {boardStages.map((stage) => {
              const cards = byStage.get(stage.id) ?? [];
              const color = stageColorFor(stage.order);
              const isDragOver = dragOverStage === stage.id;
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStage(stage.id);
                  }}
                  onDragLeave={() =>
                    setDragOverStage((s) => (s === stage.id ? null : s))
                  }
                  onDrop={(e) => handleDrop(stage, e)}
                  className={cn(
                    "w-72 shrink-0 rounded-2xl border-x border-b border-t-4 bg-slate-50/60 flex flex-col max-h-[70vh] transition-colors duration-200",
                    PANEL_GREY_SHADOW,
                    isDragOver
                      ? "border-brand-400 bg-brand-50/50"
                      : cn(stageBorderFor(stage.order), color.topBorder),
                  )}
                >
                  <div
                    className={cn(
                      "p-3 border-b border-slate-200/80 flex items-center justify-between rounded-t-lg",
                      !isDragOver && color.headerBg,
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-extrabold uppercase tracking-wide",
                        isDragOver ? "text-brand-700" : color.text,
                      )}
                    >
                      {stage.label}
                    </p>
                    <Badge
                      className={cn(
                        "text-xs border",
                        isDragOver
                          ? "bg-brand-100 text-brand-700 border-brand-200"
                          : color.badge,
                      )}
                    >
                      {cards.length}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {cards.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        No opportunities
                      </p>
                    ) : (
                      cards.map((o) => {
                        const health = computeOpportunityHealth(
                          o.stageEnteredAt,
                          o.status,
                          stage.slaDays,
                        );
                        const stageAgeDays = daysSince(o.stageEnteredAt);
                        const nextActionOverdue =
                          !!o.nextActionDate &&
                          new Date(o.nextActionDate).getTime() < Date.now();
                        const sym = currencySymbol(o.currency);
                        return (
                          <div
                            key={o.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", String(o.id))
                            }
                            onClick={() => router.push(`/crm/pipeline/${o.id}`)}
                            className="crm-panel-frame rounded-xl bg-white p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 transition-all duration-200 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-slate-800 leading-snug">
                                {o.title}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  title="Quick view"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActive(o);
                                  }}
                                  className="h-4 w-4 rounded-full flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100 hover:text-brand-600 transition-opacity"
                                >
                                  <Settings2 className="h-3 w-3" />
                                </button>
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    HEALTH_DOT[health],
                                  )}
                                  title={health}
                                />
                              </div>
                            </div>
                            <p className="text-sm text-slate-500 mt-1 truncate">
                              {o.account.name}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-slate-600">
                                {sym}
                                {fmtIN(o.estimatedValue)}
                              </span>
                              {o.priority && (
                                <Badge variant="outline" className="text-xs">
                                  {o.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-brand-600 font-semibold mt-1">
                              Expected {sym}
                              {computeExpectedRevenue(
                                num(o.estimatedValue),
                                o.probability ?? stage.probability,
                              ).toLocaleString("en-IN")}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {stageAgeDays !== null && (
                                <span
                                  className={cn(
                                    "text-xs font-semibold px-1.5 py-0.5 rounded-full border",
                                    health === "Healthy"
                                      ? "bg-slate-50 text-slate-500 border-slate-200"
                                      : health === "Delayed"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-red-50 text-red-700 border-red-200",
                                  )}
                                >
                                  {stageAgeDays}d in stage
                                </span>
                              )}
                              {!o.nextAction && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full border bg-slate-50 text-slate-400 border-slate-200">
                                  No next action
                                </span>
                              )}
                              {nextActionOverdue && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                                  Next action overdue
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OpportunityDrawer
        opportunity={active}
        accountName={active?.account.name}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
      />
      {canConfigure && (
        <PipelineStageSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          stages={stages}
          opportunities={openOpps}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-600" /> New Deal
            </DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitLabel="Create Deal"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
