"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useTickets } from "../hooks";
import { READ_ANY_SCOPE, WRITE_ANY_SCOPE } from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketItem,
  type TicketStatus,
  type TicketCategory,
} from "../types";
import { TicketDetailDialog } from "./TicketDetailDialog";
import { TicketForm } from "./TicketForm";
import { TicketStatusBadge } from "./TicketStatusBadge";

const PAGE_SIZE = 10;

interface Filters {
  status: "" | TicketStatus;
  category: "" | TicketCategory;
  q: string;
}
const EMPTY_FILTERS: Filters = { status: "", category: "", q: "" };

/**
 * Employee Tickets: the HR/admin queue (own/team/all, filterable by status,
 * category and search), with create and detail/reply/status-change via
 * dialogs. Mirrors ExitRequestsView's single scoped screen shape.
 */
export function TicketsView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };

  const list = useTickets(query, canRead);
  const hasFilters =
    filters.status !== "" || filters.category !== "" || filters.q !== "";

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the <code>hr.ticket.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            Employee Tickets
          </h1>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters
                ? `Showing ${list.data.meta.total} matching tickets`
                : `${list.data.meta.total} tickets`}
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>Raise ticket</Button>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <Select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) =>
              update("category", e.target.value as "" | TicketCategory)
            }
          >
            <option value="">All categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Search tickets"
            placeholder="Search subject, category or employee"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
          />
        </div>
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

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
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters ? "No tickets match these filters" : "No tickets yet"
            }
            description={
              hasFilters
                ? "Try a different status, category or search, or clear the filters."
                : canWrite
                  ? "Raise a ticket to see it here."
                  : "Tickets from your team will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Employee tickets"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Employee", cell: (r) => r.employee.fullName },
              { header: "Subject", cell: (r) => r.subject },
              { header: "Category", cell: (r) => r.category },
              {
                header: "Status",
                cell: (r) => <TicketStatusBadge status={r.status} />,
              },
              {
                header: "Raised by",
                cell: (r) => (r.raisedByAdmin ? "HR" : "Employee"),
              },
              {
                header: "Actions",
                cell: (r: TicketItem) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailId(r.id)}
                  >
                    View
                  </Button>
                ),
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {createOpen ? (
        <Dialog open onClose={() => setCreateOpen(false)} title="Raise ticket">
          <TicketForm
            onSubmitted={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </Dialog>
      ) : null}

      {detailId !== null ? (
        <TicketDetailDialog
          open
          ticketId={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
