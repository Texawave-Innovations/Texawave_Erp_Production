// CRM Core Domain — Sales Pipeline. New top-nav tab: a cross-account Kanban board over every
// open Opportunity (`crm/opportunities`), grouped by configurable stage (`domain/config.ts`).
// Cards can be dragged between columns (native HTML5 drag-and-drop — no extra dependency) or
// opened for full detail/stage-history/Won/Lost/On-Hold via the shared `OpportunityDrawer`.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm, celebrationKeyForStage } from "./celebration";
import {
  AlertTriangle,
  ArrowUpDown,
  Briefcase,
  IndianRupee,
  LayoutGrid,
  List,
  PauseCircle,
  Search,
  Settings2,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import { changeCrmOpportunityStage } from "./domain/opportunitiesService";
import {
  computeExpectedRevenue,
  computeOpportunityHealth,
  daysSince,
  stageColorFor,
} from "./domain/config";
import { currencySymbol, formatMultiCurrencyTotal } from "./domain/currency";
import { useCrmPipelineStages } from "./domain/pipelineStagesService";
import { canManagePipelineConfig } from "./domain/roles";
import { PipelineStageSettingsDialog } from "./domain/PipelineStageSettingsDialog";
import { OpportunityDrawer } from "./domain/OpportunityDrawer";
import { CrmOpportunity, CrmOpportunityStatus } from "./domain/types";
import { EmptyState } from "./intelligence/components";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import { ImportExportBar } from "./importExport/ImportExportBar";
import {
  FieldSchema,
  MappedImportRow,
  DuplicateStrategy,
} from "./importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "./importExport/commitHelpers";
import { CRM_OPPORTUNITIES_PATH } from "./domain/config";
import { CrmAccount, CrmContact } from "./domain/types";

function buildDealFields(
  accounts: CrmAccount[],
  contacts: CrmContact[],
): FieldSchema<CrmOpportunity>[] {
  return [
    {
      key: "title",
      label: "Deal Title",
      required: true,
      aliases: ["Opportunity", "Deal Name"],
    },
    {
      key: "accountId",
      label: "Account",
      required: true,
      aliases: ["Account Name", "Company", "Company Name"],
      exportValue: (r) =>
        accounts.find((a) => a.id === r.accountId)?.name || "",
      relation: {
        label: "Account",
        required: true,
        lookup: (raw) =>
          accounts.find(
            (a) => a.name.trim().toLowerCase() === raw.trim().toLowerCase(),
          )?.id,
      },
    },
    {
      key: "contactId",
      label: "Contact",
      aliases: ["Contact Name"],
      exportValue: (r) =>
        contacts.find((c) => c.id === r.contactId)?.name || "",
      relation: {
        label: "Contact",
        lookup: (raw) =>
          contacts.find(
            (c) => c.name.trim().toLowerCase() === raw.trim().toLowerCase(),
          )?.id,
      },
    },
    {
      key: "ownerName",
      label: "Owner",
      required: true,
      aliases: ["Deal Owner"],
    },
    {
      key: "estimatedValue",
      label: "Estimated Value",
      required: true,
      type: "currency",
    },
    { key: "currency", label: "Currency" },
    { key: "expectedCloseDate", label: "Expected Close Date", type: "date" },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: ["High", "Medium", "Low"],
    },
    { key: "nextAction", label: "Next Action" },
    { key: "nextActionDate", label: "Next Action Date", type: "date" },
    { key: "campaignSource", label: "Campaign Source" },
  ];
}

const HEALTH_DOT: Record<string, string> = {
  Healthy: "bg-emerald-500",
  Delayed: "bg-amber-500",
  Critical: "bg-red-500",
};

/** Hairline column-border colors mirroring `STAGE_COLOR_PALETTE`'s order (config.ts) — gives each
 *  Kanban stage column a full thin border in its own accent color, on top of the neutral grey
 *  drop shadow every column shares. */
const STAGE_BORDER_COLOR = [
  "border-blue-300/80",
  "border-violet-300/80",
  "border-amber-300/80",
  "border-cyan-300/80",
  "border-orange-300/80",
  "border-teal-300/80",
  "border-pink-300/80",
  "border-indigo-300/80",
] as const;

function stageBorderFor(order: number | undefined): string {
  const n = Number.isFinite(order) ? Math.floor(order as number) : 0;
  const idx =
    (((n - 1) % STAGE_BORDER_COLOR.length) + STAGE_BORDER_COLOR.length) %
    STAGE_BORDER_COLOR.length;
  return STAGE_BORDER_COLOR[idx];
}

/** Soft, neutral-grey panel shadow shared by every Kanban column / status container — never a
 *  colored glow, just enough depth to separate the panel from the page background. */
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
  CrmOpportunityStatus,
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

export default function Pipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, contacts, opportunities, loading } = useCrmDomainData();
  const { stages, boardStages } = useCrmPipelineStages();
  const slaFor = (stageId: string) =>
    stages.find((s) => s.id === stageId)?.slaDays;
  const probabilityFor = (stageId: string) =>
    stages.find((s) => s.id === stageId)?.probability;
  const canConfigure = canManagePipelineConfig(user);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CrmOpportunityStatus>("OPEN");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [active, setActive] = useState<CrmOpportunity | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const contactName = (id?: string) =>
    contacts.find((c) => c.id === id)?.name || "—";

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";

  const dealAmount = (o: CrmOpportunity) =>
    o.status === "WON"
      ? (o.closingAmount ?? o.estimatedValue)
      : o.estimatedValue;
  const dealClosingDate = (o: CrmOpportunity) =>
    o.status === "WON"
      ? o.closingDate || o.expectedCloseDate || "—"
      : o.expectedCloseDate || "—";
  const statusDetail = (o: CrmOpportunity): string => {
    if (o.status === "WON")
      return o.wonAt ? `Won ${new Date(o.wonAt).toLocaleDateString()}` : "—";
    if (o.status === "LOST")
      return o.lostReason
        ? `${o.lostReason}${o.competitor ? ` (${o.competitor})` : ""}`
        : "—";
    if (o.status === "ON_HOLD")
      return o.holdReason
        ? `${o.holdReason}${o.expectedResumeDate ? ` · resume ${o.expectedResumeDate}` : ""}`
        : "—";
    return "—";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (o.status !== statusFilter) return false;
      if (!q) return true;
      return [o.title, accountName(o.accountId), o.ownerName].some((f) =>
        (f || "").toLowerCase().includes(q),
      );
    });
  }, [opportunities, statusFilter, query, accounts]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "ownerName")
        cmp = a.ownerName.localeCompare(b.ownerName);
      else if (sortKey === "estimatedValue")
        cmp = (a.estimatedValue || 0) - (b.estimatedValue || 0);
      else if (sortKey === "expectedCloseDate")
        cmp = (a.expectedCloseDate || "").localeCompare(
          b.expectedCloseDate || "",
        );
      else cmp = (a.createdAt || 0) - (b.createdAt || 0);
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
    const map = new Map<string, CrmOpportunity[]>();
    boardStages.forEach((s) => map.set(s.id, []));
    filtered.forEach((o) => {
      const list = map.get(o.stage);
      if (list) list.push(o);
      else map.set(o.stage, [o]); // opportunities parked on a non-board stage (e.g. legacy or retired stage) still surface
    });
    return map;
  }, [filtered, boardStages]);

  const totals = useMemo(() => {
    // Built once (O(stages)) instead of `slaFor`'s own stages.find() re-scanning the stages list
    // for every single open opportunity below (O(opportunities × stages)).
    const slaByStage = new Map(stages.map((s) => [s.id, s.slaDays]));
    const open = opportunities.filter((o) => o.status === "OPEN");
    return {
      openCount: open.length,
      openValueDisplay: formatMultiCurrencyTotal(
        open.map((o) => ({
          amount: o.estimatedValue || 0,
          currency: o.currency,
        })),
      ),
      wonCount: opportunities.filter((o) => o.status === "WON").length,
      lostCount: opportunities.filter((o) => o.status === "LOST").length,
      onHoldCount: opportunities.filter((o) => o.status === "ON_HOLD").length,
      stuckCount: open.filter(
        (o) =>
          computeOpportunityHealth(
            o.stageEnteredAt,
            o.status,
            slaByStage.get(o.stage),
          ) !== "Healthy",
      ).length,
    };
  }, [opportunities, stages]);

  const statusCounts: Record<CrmOpportunityStatus, number> = {
    OPEN: totals.openCount,
    WON: totals.wonCount,
    LOST: totals.lostCount,
    ON_HOLD: totals.onHoldCount,
  };

  // Dragging a card onto a new column collects the stage-change reason via `pendingMove` below,
  // rather than writing the move immediately — every stage change needs a reason (see
  // `OpportunityDrawer`'s "Move Stage" flow), and drag-and-drop is just a second entry point into
  // the same rule, not an exception to it.
  const [pendingMove, setPendingMove] = useState<{
    opportunity: CrmOpportunity;
    targetStageId: string;
  } | null>(null);
  const [moveRemarks, setMoveRemarks] = useState("");
  const [movingBusy, setMovingBusy] = useState(false);

  const handleDrop = (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
    const oppId = e.dataTransfer.getData("text/plain");
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage === stageId) return;
    setMoveRemarks("");
    setPendingMove({ opportunity: opp, targetStageId: stageId });
  };

  const confirmPendingMove = async () => {
    if (!pendingMove || !moveRemarks.trim()) return;
    setMovingBusy(true);
    try {
      await changeCrmOpportunityStage(
        pendingMove.opportunity,
        pendingMove.targetStageId,
        currentUser,
        moveRemarks.trim(),
      );
      toast.success(
        `Moved to ${stages.find((s) => s.id === pendingMove.targetStageId)?.label || pendingMove.targetStageId}`,
      );
      celebrateCrm(celebrationKeyForStage(pendingMove.targetStageId));
      setPendingMove(null);
    } catch (err) {
      console.error("Failed to move opportunity:", err);
      toast.error("Failed to move opportunity");
    } finally {
      setMovingBusy(false);
    }
  };

  const dealFields = useMemo(
    () => buildDealFields(accounts, contacts),
    [accounts, contacts],
  );

  const commitDealsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const defaultStage = boardStages[0]?.id || "new_lead";
    const summary = await commitFirebaseImport(
      CRM_OPPORTUNITIES_PATH,
      importRows,
      strategy,
      (row, id) => {
        if (row.isDuplicate && strategy === "update")
          return { ...row.data, updatedBy: currentUser, updatedAt: Date.now() };
        const now = Date.now();
        return {
          ...row.data,
          estimatedValue: Number(row.data.estimatedValue) || 0,
          stage: defaultStage,
          stageEnteredAt: now,
          status: "OPEN",
          opportunityNumber: `OPP-${id.slice(-6).toUpperCase()}`,
          createdBy: currentUser,
          createdAt: now,
        };
      },
    );
    await logBulkImportAudit("opportunity", "Deals", summary, currentUser);
    return summary;
  };

  const activeMeta = STATUS_META[statusFilter];

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
            moduleLabel="Deals"
            fields={dealFields}
            allRecords={opportunities}
            filteredRecords={filtered}
            fileBaseName="crm-deals"
            helperNote="New deals are imported into the first pipeline stage with OPEN status — move them on the board afterward as needed."
            duplicate={{
              keys: ["title", "accountId"],
              findExisting: (mapped) => {
                const title = String(mapped.title || "")
                  .trim()
                  .toLowerCase();
                const accountId = String(mapped.accountId || "").trim();
                if (!title || !accountId) return undefined;
                const match = opportunities.find(
                  (o) =>
                    o.title.trim().toLowerCase() === title &&
                    o.accountId === accountId,
                );
                return match ? { id: match.id, label: match.title } : undefined;
              },
            }}
            commitImport={commitDealsImport}
          />
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
              "{pendingMove.opportunity.title}"
            </span>{" "}
            from{" "}
            <span className="font-bold">
              {stages.find((s) => s.id === pendingMove.opportunity.stage)
                ?.label || pendingMove.opportunity.stage}
            </span>{" "}
            to{" "}
            <span className="font-bold">
              {stages.find((s) => s.id === pendingMove.targetStageId)?.label ||
                pendingMove.targetStageId}
            </span>
            .
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
              onClick={confirmPendingMove}
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
          value={totals.wonCount}
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
        {(Object.keys(STATUS_META) as CrmOpportunityStatus[]).map((s) => {
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
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
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
                      className="font-black text-sm uppercase tracking-wider text-white cursor-pointer select-none py-2.5"
                      onClick={() => toggleSort(key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label} <ArrowUpDown className="h-3 w-3 opacity-70" />
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                    Stage
                  </TableHead>
                  <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                    Probability
                  </TableHead>
                  <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                    Expected Revenue
                  </TableHead>
                  <TableHead
                    className="font-black text-sm uppercase tracking-wider text-white cursor-pointer select-none py-2.5"
                    onClick={() => toggleSort("expectedCloseDate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {statusFilter === "WON"
                        ? "Closing Date"
                        : "Expected Close"}{" "}
                      <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </span>
                  </TableHead>
                  <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                    Account
                  </TableHead>
                  <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                    Contact
                  </TableHead>
                  <TableHead
                    className="font-black text-sm uppercase tracking-wider text-white cursor-pointer select-none py-2.5"
                    onClick={() => toggleSort("ownerName")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Owner <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </span>
                  </TableHead>
                  {statusFilter !== "OPEN" && (
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
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
                  const prob = o.probability ?? probabilityFor(o.stage);
                  return (
                    <TableRow
                      key={o.id}
                      className={cn(
                        "border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40",
                        o.status === "WON" && "bg-emerald-50/30",
                        o.status === "LOST" && "bg-red-50/30",
                        o.status === "ON_HOLD" && "bg-amber-50/30",
                      )}
                      onClick={() => navigate(`/crm/pipeline/${o.id}`)}
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
                        {currencySymbol(o.currency)}
                        {dealAmount(o).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-xs">
                          {stages.find((s) => s.id === o.stage)?.label ||
                            o.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {prob !== undefined ? `${prob}%` : "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {currencySymbol(o.currency)}
                        {computeExpectedRevenue(
                          o.estimatedValue,
                          prob,
                        ).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {dealClosingDate(o)}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {accountName(o.accountId)}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {contactName(o.contactId)}
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
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => navigate(`/crm/pipeline/${o.id}`)}
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
                    {accountName(o.accountId)}
                  </p>
                  {o.contactId && (
                    <p className="text-sm text-slate-400 mt-0.5 truncate">
                      {contactName(o.contactId)}
                    </p>
                  )}

                  {o.status === "WON" && (
                    <div className="mt-2.5 space-y-0.5 text-sm">
                      <p className="font-bold text-emerald-700">
                        {currencySymbol(o.currency)}
                        {(o.closingAmount ?? o.estimatedValue).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                      {o.closingDate && (
                        <p className="text-slate-500">
                          Closed: {o.closingDate}
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
                        <p className="font-bold text-red-700">{o.lostReason}</p>
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
                          Resume by: {o.expectedResumeDate}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                    <span className="text-sm text-slate-500 font-medium truncate">
                      {o.ownerName}
                    </span>
                    <span className="text-sm font-semibold text-slate-600 shrink-0">
                      {currencySymbol(o.currency)}
                      {o.estimatedValue.toLocaleString("en-IN")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="overflow-x-auto crm-tracker-scroll pb-2">
          <div className="flex gap-3 min-w-max">
            {boardStages.map((stage) => {
              const cards = byStage.get(stage.id) || [];
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
                  onDrop={(e) => handleDrop(stage.id, e)}
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
                        return (
                          <div
                            key={o.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", o.id)
                            }
                            onClick={() => navigate(`/crm/pipeline/${o.id}`)}
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
                              {accountName(o.accountId)}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-slate-600">
                                {currencySymbol(o.currency)}
                                {o.estimatedValue.toLocaleString("en-IN")}
                              </span>
                              {o.priority && (
                                <Badge variant="outline" className="text-xs">
                                  {o.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-brand-600 font-semibold mt-1">
                              Expected {currencySymbol(o.currency)}
                              {computeExpectedRevenue(
                                o.estimatedValue,
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
        accountName={active ? accountName(active.accountId) : undefined}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        currentUser={currentUser}
      />
      {canConfigure && (
        <PipelineStageSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          stages={stages}
          opportunities={opportunities}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
