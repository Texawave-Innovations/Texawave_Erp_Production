"use client";

import type {
  ProposalDocument,
  ProposalSortField,
  ProposalStatus,
  ProposalWorkflowAction,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  type ActionMenuItem,
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  TableSkeleton,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileText,
  History,
  Layers,
  Pencil,
  Plus,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { useProjects } from "@/features/projects/hooks";
import { errorMessage, formatDate } from "@/features/projects/format";
import {
  useDeleteProposalDocument,
  useDuplicateProposalDocument,
  useExtendProposalFollowup,
  useProposalDocument,
  useProposalDocuments,
  useProposalStats,
  useTransitionProposalDocument,
} from "../hooks";
import {
  PROPOSALS_DELETE,
  PROPOSALS_MANAGE_SETTINGS,
  PROPOSALS_MANAGE_TEMPLATES,
  PROPOSALS_READ,
  PROPOSALS_SEND,
  PROPOSALS_WRITE,
} from "../permissions";
import {
  ACTIONS_BY_STATUS,
  EDITABLE_STATUSES,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_META,
  WORKFLOW_ACTION_META,
  followUpState,
} from "../utils";
import { ExtendFollowupModal } from "./ExtendFollowupModal";
import { toProposalSheet } from "./ProposalDocumentSheet";
import { ProposalActivityTimeline } from "./ProposalActivityTimeline";
import { ProposalPreviewModal } from "./ProposalPreviewModal";
import {
  WorkflowActionDialog,
  type WorkflowActionTarget,
} from "./WorkflowActionDialog";

const PAGE_SIZE = 10;
const FOLLOW_UP_FILTER = "followup_due";

type HubTab = "proposals" | "history";

/** Legacy `proposals/ProposalsHub.tsx` — stat cards (clickable filters),
 * the proposals register with follow-up badges and per-row workflow
 * actions, and the "Workflow & Audit History" tab. */
export function ProposalsListView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(PROPOSALS_READ);
  const canWrite = usePermission(PROPOSALS_WRITE);
  const canSend = usePermission(PROPOSALS_SEND);
  const canDelete = usePermission(PROPOSALS_DELETE);
  const canTemplates = usePermission(PROPOSALS_MANAGE_TEMPLATES);
  const canSettings = usePermission(PROPOSALS_MANAGE_SETTINGS);

  const [tab, setTab] = useState<HubTab>("proposals");
  const [historyId, setHistoryId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [projectId, setProjectId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<ProposalSortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [preview, setPreview] = useState<{
    id: number;
    autoPrint: boolean;
  } | null>(null);
  const [extendTarget, setExtendTarget] = useState<ProposalDocument | null>(
    null,
  );
  const [workflowTarget, setWorkflowTarget] =
    useState<WorkflowActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalDocument | null>(
    null,
  );

  const followUpOnly = status === FOLLOW_UP_FILTER;
  const query = useProposalDocuments({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status && !followUpOnly ? status : undefined,
    followUpDue: followUpOnly || undefined,
    clientName: client || undefined,
    projectId: projectId ? Number(projectId) : undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    sortBy,
    order,
  });
  const statsQuery = useProposalStats();
  const projectsQuery = useProjects({ limit: 100 });
  const previewQuery = useProposalDocument(preview?.id ?? 0);
  const historyList = useProposalDocuments({
    page: 1,
    limit: 100,
    order: "desc",
  });

  const transitionMutation = useTransitionProposalDocument();
  const extendMutation = useExtendProposalFollowup();
  const duplicateMutation = useDuplicateProposalDocument();
  const deleteMutation = useDeleteProposalDocument();

  const hasFilters = Boolean(
    search || status || client || projectId || fromDate || toDate,
  );

  function applyStatus(next: string) {
    setStatus(next);
    setPage(1);
    setTab("proposals");
  }

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Proposal Documents"
      >
        Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
      </Alert>
    );
  }

  async function handleDuplicate(p: ProposalDocument) {
    try {
      const copy = await duplicateMutation.mutateAsync(p.id);
      toast({
        title: `Duplicated as ${copy.proposalNumber}`,
        variant: "success",
      });
      router.push(`/projects/proposals/${copy.id}`);
    } catch (err) {
      toast({
        title: "Could not duplicate",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  function rowActions(p: ProposalDocument): ActionMenuItem[] {
    const editable = EDITABLE_STATUSES.includes(p.status);
    const items: ActionMenuItem[] = [
      {
        label: editable && canWrite ? "Edit" : "Open",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => router.push(`/projects/proposals/${p.id}`),
      },
      {
        label: "Preview Document",
        icon: <Eye className="h-4 w-4" />,
        onClick: () => setPreview({ id: p.id, autoPrint: false }),
      },
      {
        label: "Download PDF",
        icon: <Download className="h-4 w-4" />,
        onClick: () => setPreview({ id: p.id, autoPrint: true }),
      },
    ];
    if (canSend) {
      ACTIONS_BY_STATUS[p.status]
        .filter((a) => a !== "archive")
        .forEach((action: ProposalWorkflowAction, i) => {
          items.push({
            label: WORKFLOW_ACTION_META[action].label,
            icon: <Send className="h-4 w-4" />,
            separator: i === 0,
            onClick: () => setWorkflowTarget({ proposal: p, action }),
          });
        });
    }
    items.push({
      label: "View History",
      icon: <History className="h-4 w-4" />,
      separator: true,
      onClick: () => {
        setHistoryId(String(p.id));
        setTab("history");
      },
    });
    if (canWrite) {
      items.push({
        label: "Duplicate",
        icon: <Copy className="h-4 w-4" />,
        onClick: () => void handleDuplicate(p),
      });
      if (p.status !== "archived") {
        items.push({
          label: p.dueDate ? "Extend Follow-up" : "Set Follow-up",
          icon: <CalendarClock className="h-4 w-4" />,
          onClick: () => setExtendTarget(p),
        });
      }
    }
    if (canSend && ACTIONS_BY_STATUS[p.status].includes("archive")) {
      items.push({
        label: "Archive",
        icon: <FileText className="h-4 w-4" />,
        onClick: () => setWorkflowTarget({ proposal: p, action: "archive" }),
      });
    }
    if (canDelete && p.status === "draft") {
      items.push({
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => setDeleteTarget(p),
      });
    }
    return items;
  }

  const stats = statsQuery.data;
  const count = (s: ProposalStatus) => stats?.byStatus[s] ?? 0;
  const documents = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg sm:p-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-theme-xs font-bold uppercase tracking-wider text-cyan-100">
              Proposal Pipeline
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Proposal Documents
            </h1>
            <p className="max-w-xl text-theme-sm text-sky-50/90">
              Client proposals from versioned templates — internal review,
              client delivery, follow-ups and a full audit trail.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSettings ? (
            <Link
              href="/projects/proposals/settings"
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-theme-sm font-semibold text-white hover:bg-white/25"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          ) : null}
          {canTemplates ? (
            <Link
              href="/projects/proposals/templates"
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-theme-sm font-semibold text-white hover:bg-white/25"
            >
              <Layers className="h-4 w-4" />
              Templates
            </Link>
          ) : null}
          {canWrite ? (
            <Link
              href="/projects/proposals/create"
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-theme-sm font-bold text-brand-700 shadow-md hover:bg-sky-50"
            >
              <Plus className="h-4 w-4" />
              Create Proposal
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          headingId="prop-stat-total"
          label="Total Proposals"
          value={stats?.total ?? 0}
          note={`${count("draft")} in draft`}
          tone="brand"
          icon={FileText}
          onClick={() => applyStatus("")}
        />
        <StatCard
          headingId="prop-stat-followups"
          label="Follow-ups Due"
          value={stats?.followUpsDue ?? 0}
          note={
            (stats?.followUpsDue ?? 0) > 0
              ? "Action required now"
              : "Nothing overdue"
          }
          tone={(stats?.followUpsDue ?? 0) > 0 ? "error" : "success"}
          icon={AlertCircle}
          onClick={() => applyStatus(FOLLOW_UP_FILTER)}
        />
        <StatCard
          headingId="prop-stat-review"
          label="Under Review"
          value={count("under_review")}
          note="Pending sign-off"
          tone="warning"
          icon={Layers}
          onClick={() => applyStatus("under_review")}
        />
        <StatCard
          headingId="prop-stat-approved"
          label="Approved"
          value={count("approved")}
          note="Ready for delivery"
          tone="success"
          icon={FileCheck}
          onClick={() => applyStatus("approved")}
        />
        <StatCard
          headingId="prop-stat-sent"
          label="Sent to Client"
          value={count("sent")}
          note={`${count("accepted")} accepted · ${count("rejected")} rejected`}
          tone="cyan"
          icon={Send}
          onClick={() => applyStatus("sent")}
        />
      </div>

      <Tabs<HubTab>
        label="Proposal hub sections"
        idPrefix="proposal-hub"
        tabs={[
          { id: "proposals", label: "All Proposals" },
          { id: "history", label: "Workflow & Audit History" },
        ]}
        value={tab}
        onChange={setTab}
      >
        {tab === "proposals" ? (
          <div className="flex flex-col gap-4">
            <Card className="relative focus-within:z-30 w-full overflow-visible">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 items-center">
                <div className="sm:col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-3">
                  <SearchInput
                    aria-label="Search proposals"
                    placeholder="Search number, title, client, project..."
                    value={search}
                    onChangeValue={(v) => {
                      setSearch(v);
                      setPage(1);
                    }}
                    clearable
                    onClear={() => setSearch("")}
                  />
                </div>
                <div className="sm:col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-2">
                  <Select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(e) => applyStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value={FOLLOW_UP_FILTER}>Follow-ups due</option>
                    {PROPOSAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PROPOSAL_STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-2">
                  <Select
                    aria-label="Filter by client"
                    value={client}
                    onChange={(e) => {
                      setClient(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All clients</option>
                    {(stats?.clients ?? []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2">
                  <Select
                    aria-label="Filter by project"
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All projects</option>
                    {(projectsQuery.data?.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.projectCode}] {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-3 min-w-0">
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-0.5">
                      From Date
                    </label>
                    <Input
                      aria-label="From Date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-0.5">
                      To Date
                    </label>
                    <Input
                      aria-label="To Date"
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>
              {hasFilters ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setClient("");
                      setProjectId("");
                      setFromDate("");
                      setToDate("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </Card>

            {query.isPending ? (
              <TableSkeleton rowsCount={6} columnsCount={8} />
            ) : query.isError ? (
              query.error instanceof ApiError &&
              query.error.isPermissionError ? (
                <Alert
                  variant="warning"
                  title="You don't have access to Proposal Documents"
                >
                  Ask an administrator for the <code>{PROPOSALS_READ}</code>{" "}
                  permission.
                </Alert>
              ) : (
                <ErrorState onRetry={() => void query.refetch()} />
              )
            ) : documents.length === 0 ? (
              <Card>
                <EmptyState
                  title={
                    hasFilters
                      ? "No proposals match these filters"
                      : "No proposals yet"
                  }
                  description={
                    hasFilters
                      ? "Try a different search or filter."
                      : canWrite
                        ? "Create your first client proposal from a template."
                        : "No proposal documents have been created yet."
                  }
                />
              </Card>
            ) : (
              <>
                <DataTable<ProposalDocument>
                  caption="Proposal documents"
                  sortColumn={sortBy}
                  sortDirection={order}
                  onSort={(key, dir) => {
                    setSortBy(key as ProposalSortField);
                    setOrder(dir);
                    setPage(1);
                  }}
                  columns={[
                    {
                      header: "Proposal #",
                      sortable: true,
                      sortKey: "proposalNumber",
                      cell: (p) => (
                        <Link
                          href={`/projects/proposals/${p.id}`}
                          className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                        >
                          {p.proposalNumber}
                        </Link>
                      ),
                    },
                    {
                      header: "Title / Project",
                      sortable: true,
                      sortKey: "title",
                      cell: (p) => (
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white/90">
                            {p.title}
                          </p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            {p.projectName ?? "Independent"}
                            {p.projectCode ? ` · ${p.projectCode}` : ""}
                          </p>
                        </div>
                      ),
                    },
                    { header: "Client", cell: (p) => p.clientName ?? "—" },
                    {
                      header: "Template",
                      cell: (p) => (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {p.templateTitle ?? "Standard"}
                          </p>
                          {p.templateVersion ? (
                            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                              V{p.templateVersion}
                            </p>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      header: "Created",
                      sortable: true,
                      sortKey: "createdAt",
                      cell: (p) => (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {formatDate(p.createdAt)}
                          </p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            {p.createdByName ?? "—"}
                          </p>
                        </div>
                      ),
                    },
                    {
                      header: "Follow-up Due",
                      sortable: true,
                      sortKey: "dueDate",
                      cell: (p) => (
                        <FollowUpBadge
                          proposal={p}
                          onClick={
                            canWrite && p.status !== "archived"
                              ? () => setExtendTarget(p)
                              : undefined
                          }
                        />
                      ),
                    },
                    {
                      header: "Status",
                      align: "center",
                      cell: (p) => (
                        <StatusBadge
                          label={PROPOSAL_STATUS_META[p.status].label}
                          colorToken={PROPOSAL_STATUS_META[p.status].tone}
                        />
                      ),
                    },
                    {
                      header: "Actions",
                      headerClassName: "sr-only",
                      align: "right",
                      cell: (p) => (
                        <ActionMenu
                          ariaLabel={`Actions for ${p.proposalNumber}`}
                          items={rowActions(p)}
                        />
                      ),
                    },
                  ]}
                  rows={documents}
                  getRowKey={(p) => String(p.id)}
                />
                {meta ? (
                  <Pagination
                    page={meta.page}
                    totalPages={meta.totalPages}
                    totalItems={meta.total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : (
          <HistoryTab
            proposals={historyList.data?.data ?? []}
            loading={historyList.isPending}
            selectedId={historyId}
            onSelect={setHistoryId}
          />
        )}
      </Tabs>

      <ProposalPreviewModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        data={
          preview && previewQuery.data
            ? toProposalSheet(previewQuery.data)
            : null
        }
        autoPrint={preview?.autoPrint ?? false}
      />
      <ExtendFollowupModal
        proposal={extendTarget}
        onClose={() => setExtendTarget(null)}
        loading={extendMutation.isPending}
        onConfirm={async ({ dueDate, reason }) => {
          if (!extendTarget) return;
          try {
            await extendMutation.mutateAsync({
              id: extendTarget.id,
              input: { dueDate, reason },
            });
            toast({
              title: `Follow-up for ${extendTarget.proposalNumber} set to ${formatDate(dueDate)}`,
              variant: "success",
            });
            setExtendTarget(null);
          } catch (err) {
            toast({
              title: "Could not update the follow-up",
              description: errorMessage(err, ""),
              variant: "error",
            });
          }
        }}
      />
      <WorkflowActionDialog
        target={workflowTarget}
        onClose={() => setWorkflowTarget(null)}
        loading={transitionMutation.isPending}
        onConfirm={async (comments) => {
          if (!workflowTarget) return;
          const { proposal, action } = workflowTarget;
          try {
            await transitionMutation.mutateAsync({
              id: proposal.id,
              input: { action, comments },
            });
            toast({
              title: `${proposal.proposalNumber}: ${WORKFLOW_ACTION_META[action].label}`,
              variant: "success",
            });
            setWorkflowTarget(null);
          } catch (err) {
            toast({
              title: "Could not update the status",
              description: errorMessage(err, ""),
              variant: "error",
            });
          }
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            toast({
              title: `${deleteTarget.proposalNumber} deleted`,
              variant: "success",
            });
            setDeleteTarget(null);
          } catch (err) {
            toast({
              title: "Could not delete",
              description: errorMessage(err, ""),
              variant: "error",
            });
          }
        }}
        title="Delete this draft proposal?"
        itemName={deleteTarget?.proposalNumber}
        confirmText="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function FollowUpBadge({
  proposal,
  onClick,
}: {
  proposal: ProposalDocument;
  onClick?: (() => void) | undefined;
}) {
  const state = followUpState(proposal.status, proposal.dueDate);
  const extensions =
    proposal.followUpExtensionCount > 0
      ? ` · ${proposal.followUpExtensionCount}x`
      : "";
  const content =
    state === "none" ? (
      <span className="text-theme-xs text-gray-400">
        {onClick ? "+ Set date" : "—"}
      </span>
    ) : state === "overdue" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-theme-xs font-bold text-error-700 dark:bg-error-950 dark:text-error-300">
        <AlertCircle className="h-3 w-3" />
        Overdue ({formatDate(proposal.dueDate)}){extensions}
      </span>
    ) : state === "today" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-theme-xs font-bold text-warning-700 dark:bg-warning-950 dark:text-warning-300">
        <Clock className="h-3 w-3" />
        Due Today{extensions}
      </span>
    ) : state === "closed" ? (
      <span className="inline-flex items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
        <CheckCircle2 className="h-3 w-3" />
        {formatDate(proposal.dueDate)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <Clock className="h-3 w-3" />
        {formatDate(proposal.dueDate)}
        {extensions}
      </span>
    );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title="Set or extend the follow-up date"
      className="hover:opacity-80"
    >
      {content}
    </button>
  ) : (
    content
  );
}

function HistoryTab({
  proposals,
  loading,
  selectedId,
  onSelect,
}: {
  proposals: ProposalDocument[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const detail = useProposalDocument(Number(selectedId) || 0);
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Select
          aria-label="Select a proposal"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">
            {loading
              ? "Loading proposals..."
              : "Select a proposal to see its history"}
          </option>
          {proposals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.proposalNumber} — {p.title}
            </option>
          ))}
        </Select>
        {!selectedId ? (
          <EmptyState
            title="No proposal selected"
            description="Pick a proposal to view its workflow and audit trail."
          />
        ) : detail.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : detail.isError ? (
          <ErrorState onRetry={() => void detail.refetch()} />
        ) : (
          <ProposalActivityTimeline activities={detail.data.activities ?? []} />
        )}
      </div>
    </Card>
  );
}
