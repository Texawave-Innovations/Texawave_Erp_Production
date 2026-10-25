"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useMyTickets } from "../hooks";
import { SELF_SERVICE_CREATE, SELF_SERVICE_READ } from "../permissions";
import { STATUS_LABELS } from "../status";
import { TICKET_STATUSES, type TicketItem, type TicketStatus } from "../types";
import { CreateMyTicketDialog } from "./CreateMyTicketDialog";
import { MyTicketDetailDialog } from "./MyTicketDetailDialog";

// Legacy employee/RaiseTicket.tsx statusConfig.
const STATUS_STYLE: Record<TicketStatus, { cls: string; icon: LucideIcon }> = {
  OPEN: {
    cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    icon: Clock,
  },
  IN_PROGRESS: {
    cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    icon: CircleAlert,
  },
  RESOLVED: {
    cls: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
    icon: CircleCheck,
  },
  CLOSED: {
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    icon: CircleX,
  },
};

function StatusPill({ status }: { status: TicketStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      <s.icon className="h-3 w-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function fmt(iso: string, withYear = true): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(iso));
}

/**
 * Tickets, laid out like the legacy page (TexaWave_ERP_old
 * src/modules/employee/RaiseTicket.tsx): "Tickets" header with New Ticket,
 * a "Notices from Admin / HR" card (each notice opens its thread to reply),
 * then the "My Tickets" card — search, status filter, and a Category /
 * Subject / Description / Action table with View and Edit. Viewing, editing
 * an open ticket and replying all happen in the ticket's detail dialog,
 * where HR's replies are a comments thread.
 */
export function MyTicketsView() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TicketStatus>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const list = useMyTickets({ page: 1, limit: 100 });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the{" "}
        <code>employee_self_service.ticket.read</code> permission.
      </Alert>
    );
  }

  const all = [...(list.data?.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const notices = all.filter((t) => t.raisedByAdmin);
  const mine = all.filter((t) => !t.raisedByAdmin);
  const openNotices = notices.filter((t) => t.status === "OPEN").length;
  const q = search.trim().toLowerCase();
  const filtered = mine.filter((t) => {
    if (status && t.status !== status) return false;
    if (!q) return true;
    return (
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Tickets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Submit issues or view notices from HR / Admin
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Ticket
          </Button>
        ) : null}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
      ) : (
        <>
          {notices.length > 0 ? (
            <Card className="overflow-hidden border border-purple-200 bg-purple-50/30 p-0 dark:border-purple-900/60 dark:bg-purple-950/20">
              <h2 className="flex items-center gap-2 border-b border-purple-100 bg-purple-50/70 px-5 py-3 text-sm font-semibold text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200">
                <Megaphone
                  className="h-4 w-4 text-purple-600"
                  aria-hidden="true"
                />
                Notices from Admin / HR
                {openNotices > 0 ? (
                  <span className="ml-auto rounded-full bg-purple-600 px-2 py-0.5 text-[10px] text-white">
                    {openNotices} new
                  </span>
                ) : null}
              </h2>
              <ul className="divide-y divide-purple-100/60 dark:divide-purple-900/40">
                {notices.map((t) => (
                  <li
                    key={t.id}
                    className="p-4 transition-colors hover:bg-purple-50/50 dark:hover:bg-purple-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t.subject}
                          </span>
                          <span className="rounded border border-purple-300 bg-purple-50 px-1.5 text-[10px] text-purple-600 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                            {t.category}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t.description}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          From:{" "}
                          <span className="font-medium text-purple-700 dark:text-purple-300">
                            {t.raisedBy?.fullName ?? "Admin/HR"}
                          </span>
                          {" · "}
                          {fmt(t.createdAt)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs"
                          onClick={() => setDetailId(t.id)}
                        >
                          <MessageSquare
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                          View &amp; Reply
                        </Button>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-0">
            <div className="flex flex-col justify-between gap-4 border-b border-gray-200 p-5 sm:flex-row sm:items-center dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <TicketCheck
                  className="h-5 w-5 text-brand-500"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  My Tickets
                </h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {filtered.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 sm:flex-initial">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="Search my tickets"
                    placeholder="Search tickets..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 sm:w-60"
                  />
                </div>
                <Select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "" | TicketStatus)
                  }
                  className="w-36"
                >
                  <option value="">All Status</option>
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {mine.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <TicketCheck
                    className="h-6 w-6 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  No tickets raised yet
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
                  Create a ticket to get help from HR / Admin.
                </p>
                {canCreate ? (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Raise your first ticket
                  </Button>
                ) : null}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Search
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  No matching tickets
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Try adjusting your search terms or status filter.
                </p>
              </div>
            ) : (
              <DataTable<TicketItem>
                caption="My tickets"
                rows={filtered}
                getRowKey={(t) => String(t.id)}
                columns={[
                  {
                    header: "Category",
                    cell: (t) => (
                      <span className="rounded border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-700">
                        {t.category}
                      </span>
                    ),
                  },
                  {
                    header: "Subject",
                    cell: (t) => (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                          {t.subject}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusPill status={t.status} />
                          <span className="font-mono text-[10px] text-gray-500">
                            {fmt(t.createdAt, false)}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Description",
                    cell: (t) => (
                      <p
                        className="max-w-xs truncate text-xs text-gray-500 md:max-w-md"
                        title={t.description}
                      >
                        {t.description}
                      </p>
                    ),
                  },
                  {
                    header: "Action",
                    headerClassName: "text-right",
                    className: "text-right whitespace-nowrap",
                    cell: (t) => (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailId(t.id)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </Button>
                        {t.status === "OPEN" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Edit ticket ${t.subject}`}
                            onClick={() => setDetailId(t.id)}
                          >
                            <Pencil
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </>
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
