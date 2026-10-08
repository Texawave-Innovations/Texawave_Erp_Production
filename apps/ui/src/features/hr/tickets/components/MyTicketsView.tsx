"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
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
  const [detailId, setDetailId] = useState<number | null>(null);

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
  const hasFilters = filters.status !== "" || filters.q !== "";

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to tickets">
        Ask an administrator for the{" "}
        <code>employee_self_service.ticket.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            My Tickets
          </h1>
          {list.data ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {hasFilters
                ? `Showing ${list.data.meta.total} matching tickets`
                : `${list.data.meta.total} tickets`}
            </p>
          ) : null}
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>Raise ticket</Button>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <Input
            aria-label="Search my tickets"
            placeholder="Search subject, description or category"
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
                ? "Try a different status or search, or clear the filters."
                : canCreate
                  ? "Raise a ticket to get help from HR."
                  : "Tickets and notices from HR will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="My tickets"
            rows={list.data.data}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Subject", cell: (r) => r.subject },
              { header: "Category", cell: (r) => r.category },
              {
                header: "Status",
                cell: (r) => <TicketStatusBadge status={r.status} />,
              },
              {
                header: "Raised by",
                cell: (r) => (r.raisedByAdmin ? "HR" : "Me"),
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
