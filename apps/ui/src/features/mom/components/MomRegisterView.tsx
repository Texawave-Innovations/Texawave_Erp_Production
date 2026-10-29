"use client";

import type { MomDocument, MomSortField } from "@texawave-erp/api-types";
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
  StatCard,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FilePenLine,
  GitBranch,
  History,
  Layers,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
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
  useArchiveMomDocument,
  useDeleteMomDocument,
  useMomDocument,
  useMomDocuments,
  useMomStats,
  useRestoreMomDocument,
  useStartMomRevision,
} from "../hooks";
import {
  MOM_DELETE,
  MOM_MANAGE_TEMPLATES,
  MOM_READ,
  MOM_WRITE,
} from "../permissions";
import {
  attendanceOf,
  formatTimeRange,
  momStatusLabel,
  momStatusTone,
  toSheetData,
} from "../utils";
import { MomPreviewModal } from "./MomPreviewModal";
import { MomRevisionHistoryModal } from "./MomRevisionHistoryModal";
import { StartRevisionDialog } from "./StartRevisionDialog";

const PAGE_SIZE = 10;

type PendingAction =
  | { kind: "preview"; id: number; autoPrint: boolean }
  | { kind: "history"; id: number }
  | { kind: "revision"; doc: MomDocument }
  | { kind: "archive"; doc: MomDocument }
  | { kind: "delete"; doc: MomDocument }
  | null;

/** Legacy `mom/pages/MomRegisterPage.tsx` — the cross-project register:
 * stat cards, search / project / status / date-range filters, sortable
 * table, and per-row actions (preview, PDF, edit, history, revision,
 * archive/restore, delete). */
export function MomRegisterView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(MOM_READ);
  const canWrite = usePermission(MOM_WRITE);
  const canDelete = usePermission(MOM_DELETE);
  const canManageTemplates = usePermission(MOM_MANAGE_TEMPLATES);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<MomSortField>("meetingDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [pending, setPending] = useState<PendingAction>(null);

  const query = useMomDocuments({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    projectId: projectId ? Number(projectId) : undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    sortBy,
    order,
  });
  const statsQuery = useMomStats();
  const projectsQuery = useProjects({ limit: 100 });

  const targetId =
    pending && (pending.kind === "preview" || pending.kind === "history")
      ? pending.id
      : 0;
  const targetQuery = useMomDocument(targetId);

  const archiveMutation = useArchiveMomDocument();
  const restoreMutation = useRestoreMomDocument();
  const deleteMutation = useDeleteMomDocument();
  const startRevisionMutation = useStartMomRevision();

  const hasFilters = Boolean(
    search || projectId || status || fromDate || toDate,
  );

  function resetFilters() {
    setSearch("");
    setProjectId("");
    setStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  async function run(
    action: () => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    try {
      await action();
      toast({ title: success, variant: "success" });
      setPending(null);
    } catch (err) {
      toast({
        title: failure,
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Minutes of Meeting"
      >
        Ask an administrator for the <code>{MOM_READ}</code> permission.
      </Alert>
    );
  }

  function rowActions(m: MomDocument): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      {
        label: "Open Document",
        icon: <Eye className="h-4 w-4" />,
        onClick: () => router.push(`/projects/mom/${m.id}`),
      },
      {
        label: "Preview",
        icon: <FilePenLine className="h-4 w-4" />,
        onClick: () =>
          setPending({ kind: "preview", id: m.id, autoPrint: false }),
      },
      {
        label: "Download PDF",
        icon: <Download className="h-4 w-4" />,
        onClick: () =>
          setPending({ kind: "preview", id: m.id, autoPrint: true }),
      },
      {
        label: "History & Revisions",
        icon: <History className="h-4 w-4" />,
        onClick: () => setPending({ kind: "history", id: m.id }),
      },
    ];
    if (canWrite && (m.status === "draft" || m.workingRevision)) {
      items.push({
        label: m.workingRevision
          ? `Continue Revision ${m.workingRevision}`
          : "Edit Draft",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => router.push(`/projects/mom/${m.id}/edit`),
      });
    }
    if (canWrite && m.status === "finalized" && !m.workingRevision) {
      items.push({
        label: "Create Revision",
        icon: <GitBranch className="h-4 w-4" />,
        onClick: () => setPending({ kind: "revision", doc: m }),
      });
    }
    if (canDelete && m.status !== "archived") {
      items.push({
        label: "Archive",
        icon: <Archive className="h-4 w-4" />,
        separator: true,
        onClick: () => setPending({ kind: "archive", doc: m }),
      });
    }
    if (canWrite && m.status === "archived") {
      items.push({
        label: "Restore",
        icon: <RotateCcw className="h-4 w-4" />,
        separator: true,
        onClick: () =>
          void run(
            () => restoreMutation.mutateAsync(m.id),
            `${m.reference} restored`,
            "Could not restore",
          ),
      });
    }
    if (canDelete && m.status === "draft") {
      items.push({
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => setPending({ kind: "delete", doc: m }),
      });
    }
    return items;
  }

  const stats = statsQuery.data;
  const documents = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg sm:p-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
            <NotebookPen className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-theme-xs font-bold uppercase tracking-wider text-cyan-100">
              Cross-Project Register
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Minutes of Meeting (MoM)
            </h1>
            <p className="max-w-xl text-theme-sm text-sky-50/90">
              Official project meeting minutes — recorded deliberations,
              decisions, and action items, with revision control and an audit
              trail.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageTemplates ? (
            <Link
              href="/projects/mom/templates"
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-theme-sm font-semibold text-white hover:bg-white/25"
            >
              <Layers className="h-4 w-4" />
              Manage Templates
            </Link>
          ) : null}
          {canWrite ? (
            <Link
              href="/projects/mom/create"
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-theme-sm font-bold text-brand-700 shadow-md hover:bg-sky-50"
            >
              <Plus className="h-4 w-4" />
              Create MoM
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headingId="mom-stat-total"
          label="Total Meetings"
          value={stats?.total ?? 0}
          note="Across all projects"
          tone="brand"
          icon={ClipboardList}
        />
        <StatCard
          headingId="mom-stat-finalized"
          label="Finalized Records"
          value={stats?.finalized ?? 0}
          note="Official, locked minutes"
          tone="success"
          icon={CheckCircle2}
        />
        <StatCard
          headingId="mom-stat-draft"
          label="Drafts in Progress"
          value={stats?.draft ?? 0}
          note="Not yet finalized"
          tone="cyan"
          icon={Pencil}
        />
        <StatCard
          headingId="mom-stat-revision"
          label="Open Revisions"
          value={stats?.inRevision ?? 0}
          note={`${stats?.archived ?? 0} archived`}
          tone="warning"
          icon={GitBranch}
        />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SearchInput
            aria-label="Search meeting minutes"
            placeholder="Search reference, title, project, client..."
            value={search}
            onChangeValue={(v) => {
              setSearch(v);
              setPage(1);
            }}
            clearable
            onClear={() => setSearch("")}
            className="xl:col-span-2"
          />
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
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="archived">Archived</option>
          </Select>
          <Input
            aria-label="Meeting date from"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            aria-label="Meeting date to"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to Minutes of Meeting"
          >
            Ask an administrator for the <code>{MOM_READ}</code> permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No meetings match these filters"
                : "No meeting minutes yet"
            }
            description={
              hasFilters
                ? "Try a different search, project, status, or date range."
                : canWrite
                  ? "Record your first meeting to see it here."
                  : "No meeting minutes have been recorded yet."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<MomDocument>
            caption="Minutes of meeting register"
            sortColumn={sortBy}
            sortDirection={order}
            onSort={(key, dir) => {
              setSortBy(key as MomSortField);
              setOrder(dir);
              setPage(1);
            }}
            columns={[
              {
                header: "Reference",
                sortable: true,
                sortKey: "reference",
                cell: (m) => (
                  <span className="font-semibold text-brand-700 dark:text-brand-400">
                    {m.reference}
                  </span>
                ),
              },
              {
                header: "Meeting",
                sortable: true,
                sortKey: "meetingTitle",
                cell: (m) => (
                  <div className="min-w-0">
                    <Link
                      href={`/projects/mom/${m.id}`}
                      className="font-semibold text-gray-900 hover:text-brand-600 hover:underline dark:text-white/90"
                    >
                      {m.meetingTitle}
                    </Link>
                    {m.templateTitle ? (
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {m.templateTitle}
                        {m.templateVersion ? ` · V${m.templateVersion}` : ""}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Project",
                cell: (m) =>
                  m.projectName ? (
                    <div>
                      <p className="text-gray-800 dark:text-gray-200">
                        {m.projectName}
                      </p>
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {m.projectCode ?? ""}
                        {m.clientName ? ` · ${m.clientName}` : ""}
                      </p>
                    </div>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Date & Time",
                sortable: true,
                sortKey: "meetingDate",
                cell: (m) => (
                  <div>
                    <p className="text-gray-800 dark:text-gray-200">
                      {formatDate(m.meetingDate)}
                    </p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {formatTimeRange(m.startTime, m.endTime, null)}
                    </p>
                  </div>
                ),
              },
              {
                header: "Status",
                align: "center",
                cell: (m) => (
                  <StatusBadge
                    label={momStatusLabel(m)}
                    colorToken={momStatusTone(m)}
                  />
                ),
              },
              {
                header: "Rev",
                align: "center",
                cell: (m) => `Rev ${m.currentRevision}`,
              },
              {
                header: "Attendees",
                align: "center",
                cell: (m) =>
                  (m.attendeesJson ?? []).filter(
                    (a) => attendanceOf(a) !== "absent",
                  ).length,
              },
              {
                header: "Last Updated",
                sortable: true,
                sortKey: "updatedAt",
                cell: (m) => formatDate(m.updatedAt),
              },
              {
                header: "Actions",
                headerClassName: "sr-only",
                align: "right",
                cell: (m) => (
                  <ActionMenu
                    ariaLabel={`Actions for ${m.reference}`}
                    items={rowActions(m)}
                  />
                ),
              },
            ]}
            rows={documents}
            getRowKey={(m) => String(m.id)}
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

      <MomPreviewModal
        open={pending?.kind === "preview"}
        onClose={() => setPending(null)}
        data={
          pending?.kind === "preview" && targetQuery.data
            ? toSheetData(targetQuery.data)
            : null
        }
        autoPrint={pending?.kind === "preview" && pending.autoPrint}
      />
      <MomRevisionHistoryModal
        open={pending?.kind === "history"}
        onClose={() => setPending(null)}
        document={
          pending?.kind === "history" ? (targetQuery.data ?? null) : null
        }
      />
      {pending?.kind === "revision" ? (
        <StartRevisionDialog
          open
          onClose={() => setPending(null)}
          currentRevision={pending.doc.currentRevision}
          loading={startRevisionMutation.isPending}
          onConfirm={async (reason) => {
            const doc = pending.doc;
            try {
              await startRevisionMutation.mutateAsync({
                id: doc.id,
                input: { reason },
              });
              setPending(null);
              router.push(`/projects/mom/${doc.id}/edit`);
            } catch (err) {
              toast({
                title: "Could not start a revision",
                description: errorMessage(err, "Please try again."),
                variant: "error",
              });
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={pending?.kind === "archive"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind !== "archive") return;
          const doc = pending.doc;
          return run(
            () => archiveMutation.mutateAsync(doc.id),
            `${doc.reference} archived`,
            "Could not archive",
          );
        }}
        title="Archive meeting minutes?"
        description="The record stays in history and can be restored later."
        itemName={
          pending?.kind === "archive" ? pending.doc.reference : undefined
        }
        confirmText="Archive"
        variant="destructive"
        loading={archiveMutation.isPending}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind !== "delete") return;
          const doc = pending.doc;
          return run(
            () => deleteMutation.mutateAsync(doc.id),
            `${doc.reference} deleted`,
            "Could not delete",
          );
        }}
        title="Delete this draft?"
        description="The draft will be removed from the register."
        itemName={
          pending?.kind === "delete" ? pending.doc.reference : undefined
        }
        confirmText="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
