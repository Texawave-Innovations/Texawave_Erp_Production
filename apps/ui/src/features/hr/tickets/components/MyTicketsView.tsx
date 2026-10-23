"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { HrPageHeader } from "@/features/hr/components";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  PlayCircle,
  Plus,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useMyTickets } from "../hooks";
import { SELF_SERVICE_CREATE, SELF_SERVICE_READ } from "../permissions";
import { STATUS_LABELS } from "../status";
import { TICKET_STATUSES, type TicketItem, type TicketStatus } from "../types";
import { CreateMyTicketDialog } from "./CreateMyTicketDialog";
import { MyTicketDetailDialog } from "./MyTicketDetailDialog";
import { TicketStatusBadge } from "./TicketStatusBadge";

const PAGE_SIZE = 10;

interface Filters {
  status: "" | TicketStatus;
  q: string;
}
const EMPTY_FILTERS: Filters = { status: "", q: "" };

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * My Tickets (legacy `employee/RaiseTicket.tsx`): tickets I raised, and
 * notices HR raised for me, in one scoped list — raise a new ticket, view
 * details, reply to HR notices and edit an open ticket of my own.
 */
export function MyTicketsView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const searchParams = useSearchParams();
  const targetIdParam =
    searchParams?.get("id") || searchParams?.get("ticketId");
  const [detailId, setDetailId] = useState<number | null>(() => {
    if (!targetIdParam) return null;
    const parsed = parseInt(targetIdParam, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  });
  const [prevTargetIdParam, setPrevTargetIdParam] = useState(targetIdParam);
  if (targetIdParam !== prevTargetIdParam) {
    setPrevTargetIdParam(targetIdParam);
    const parsed = targetIdParam ? parseInt(targetIdParam, 10) : NaN;
    setDetailId(!isNaN(parsed) && parsed > 0 ? parsed : null);
  }

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };

  const list = useMyTickets(query);
  // Unfiltered overview query to ensure card counts stay accurate regardless of active filters
  const overview = useMyTickets({ page: 1, limit: 100 });

  const overviewCounts = useMemo(() => {
    const items = overview.data?.data ?? [];
    return {
      all: overview.data?.meta.total ?? items.length,
      OPEN: items.filter((t) => t.status === "OPEN").length,
      IN_PROGRESS: items.filter((t) => t.status === "IN_PROGRESS").length,
      RESOLVED: items.filter(
        (t) => t.status === "RESOLVED" || t.status === "CLOSED",
      ).length,
    };
  }, [overview.data]);

  const hasFilters = filters.status !== "" || filters.q !== "";

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the{" "}
        <code>employee_self_service.ticket.read</code> permission.
      </Alert>
    );
  }

  const summaryConfig: {
    label: string;
    value: "" | TicketStatus;
    Icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    {
      label: "All Tickets",
      value: "",
      Icon: Inbox,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    },
    {
      label: "Open",
      value: "OPEN",
      Icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "In Progress",
      value: "IN_PROGRESS",
      Icon: PlayCircle,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Resolved",
      value: "RESOLVED",
      Icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Standard Enterprise Page Header */}
      <HrPageHeader
        title="Help Desk Tickets"
        description="Submit workplace inquiries, track resolution progress, and respond to HR notices."
        icon3d="tickets"
        action={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl font-bold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Raise ticket</span>
            </Button>
          ) : null
        }
      />

      {/* 2. Interactive Status Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryConfig.map((cfg) => {
          const isSelected = filters.status === cfg.value;
          const count = overview.isPending
            ? "—"
            : cfg.value === ""
              ? overviewCounts.all
              : (overviewCounts[cfg.value as keyof typeof overviewCounts] ?? 0);

          return (
            <button
              key={cfg.label}
              type="button"
              onClick={() => {
                update("status", filters.status === cfg.value ? "" : cfg.value);
              }}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-2 border-brand-500 bg-sky-50/80 shadow-xs ring-2 ring-brand-500/15 dark:bg-slate-800"
                  : "border border-sky-200/90 bg-white hover:border-brand-300 hover:bg-sky-50/40 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}
              >
                <cfg.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {cfg.label}
                </span>
                <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                  {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Bar: Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <div className="w-full sm:w-72">
          <Input
            aria-label="Search my tickets"
            placeholder="Search subject or category..."
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as "" | TicketStatus)
            }
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Tickets Table or States */}
      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to tickets">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={
              hasFilters ? "No tickets match these filters" : "No tickets yet"
            }
            description={
              hasFilters
                ? "Try a different status or search, or clear the filters."
                : canCreate
                  ? "Raise a ticket to get prompt assistance from HR or IT."
                  : "Tickets and notices from HR will appear here."
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable
            className="border-0 shadow-none rounded-none"
            caption="My tickets"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Subject & Details",
                cell: (r) => (
                  <div className="flex flex-col gap-1.5 py-1">
                    <span className="font-bold text-[#0a3271] dark:text-white">
                      {r.subject}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                        {r.category}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (r) => <TicketStatusBadge status={r.status} />,
              },
              {
                header: "Source",
                cell: (r) =>
                  r.raisedByAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      HR Notice
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      My Request
                    </span>
                  ),
              },
              {
                header: "Actions",
                cell: (r: TicketItem) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailId(r.id)}
                    className="flex items-center gap-1.5 rounded-lg font-semibold hover:border-brand-300 hover:text-brand-600"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </Button>
                ),
              },
            ]}
          />
          {list.data.meta.totalPages > 1 ? (
            <div className="border-t border-sky-100 p-3 dark:border-slate-800">
              <Pagination
                page={list.data.meta.page}
                totalPages={list.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}

      {createOpen ? (
        <CreateMyTicketDialog open onClose={() => setCreateOpen(false)} />
      ) : null}

      {detailId !== null ? (
        <MyTicketDetailDialog
          open
          ticketId={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
