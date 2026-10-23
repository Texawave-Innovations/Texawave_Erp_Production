"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Semantic3DIcon,
  Skeleton,
  Tabs,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { useExitRequests, useMyExitRequests } from "../hooks";
import {
  DECIDE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  ACTIVE_STATUSES,
  EXIT_REQUEST_STATUSES,
  type ExitRequestStatus,
} from "../types";
import { ExitRequestCard } from "./ExitRequestCard";
import { SubmitExitRequestDialog } from "./SubmitExitRequestDialog";

const PAGE_SIZE = 10;

interface TabDef {
  id: "team" | "mine";
  label: string;
}

export function ExitRequestsView() {
  const canReadMine = usePermission(SELF_SERVICE_READ);
  const canCreateMine = usePermission(SELF_SERVICE_CREATE);
  const canReadAny = usePermission(READ_ANY_SCOPE);
  const canDecide = usePermission(DECIDE_ANY_SCOPE);

  // Submit modal state
  const [submitOpen, setSubmitOpen] = useState(false);

  // Tabs setup
  const tabs: TabDef[] = [];
  if (canReadAny) {
    tabs.push({ id: "team", label: "Team & Organization Queue" });
  }
  if (canReadMine) {
    tabs.push({ id: "mine", label: "My Exit Requests" });
  }

  const [activeTab, setActiveTab] = useState<"team" | "mine">(
    canReadAny ? "team" : "mine",
  );

  // My requests query for checking active request & self-service count
  const myRequestsQuery = useMyExitRequests(
    { page: 1, limit: 10 },
  );

  const hasActiveMyRequest = useMemo(() => {
    return (
      myRequestsQuery.data?.data.some((r) => ACTIVE_STATUSES.includes(r.status)) ??
      false
    );
  }, [myRequestsQuery.data]);

  // Team search and filters state
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<"" | ExitRequestStatus>("");

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const teamRequestsQuery = useExitRequests(queryParams, canReadAny);

  // KPI Metrics calculation based on loaded data
  const { totalRequests, pendingCount, inNoticeCount, completedCount } =
    useMemo(() => {
      const items = teamRequestsQuery.data?.data ?? [];
      const total = teamRequestsQuery.data?.meta.total ?? items.length;
      const pending = items.filter(
        (r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW",
      ).length;
      const notice = items.filter((r) => r.status === "APPROVED").length;
      const completed = items.filter((r) => r.status === "COMPLETED").length;

      return {
        totalRequests: total,
        pendingCount: pending,
        inNoticeCount: notice,
        completedCount: completed,
      };
    }, [teamRequestsQuery.data]);

  const hasFilters = searchInput !== "" || statusFilter !== "";

  const handleClearFilters = () => {
    setSearchInput("");
    setStatusFilter("");
    setPage(1);
  };

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to exit requests">
        Ask an administrator for the{" "}
        <code>employee_self_service.exit_request.read</code> or{" "}
        <code>hr.exit_request.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12 animate-reveal contain-[inline-size]">
      {/* Executive Hero Banner (Primary Banner Color) */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/60 bg-linear-to-r from-[#478cf9] via-25%-[#9EDCF7] via-25% to-[#49aff8] via-50% to-[#8BE9F0] via-40% to-[#81edf5] p-6 shadow-[0_4px_24px_-4px_rgba(56,189,248,0.14)] dark:border-sky-800/40 dark:from-[#0d2238] dark:via-[#132d4b] dark:to-[#0f2844]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                Exit Requests & Offboarding
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-[#0a3271] shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
                Resignation Workflow
              </span>
            </div>
            <p className="max-w-2xl text-[12px] font-medium text-[#0a3271]/85 dark:text-sky-200/80">
              Manage employee resignations, notice period milestones, handover tracking, and final settlement clearances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canCreateMine ? (
              <Button
                onClick={() => setSubmitOpen(true)}
                disabled={hasActiveMyRequest}
                title={
                  hasActiveMyRequest
                    ? "You already have an active exit request"
                    : "Submit a new resignation / exit request"
                }
                className="rounded-xl bg-white hover:bg-sky-50 px-4 py-2 text-xs font-bold text-[#0a3271] shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Raise Exit Request
              </Button>
            ) : null}
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white shadow-[0_6px_20px_rgba(30,100,180,0.12)] ring-4 ring-white/60 dark:border-slate-700 dark:bg-slate-800">
              <Semantic3DIcon name="exit-requests" size={36} alt="Exit requests" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Clickable Metric Summary Cards for Interactive Filtering */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Requests Card */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("team");
            setStatusFilter("");
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "" && searchInput === ""
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Exit Requests
              </p>
              {statusFilter === "" && searchInput === "" ? (
                <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-sky-300">
                  Active
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalRequests}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click to view all records
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </button>

        {/* Pending Review Card */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("team");
            setStatusFilter((prev) => (prev === "SUBMITTED" ? "" : "SUBMITTED"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "SUBMITTED" || statusFilter === "UNDER_REVIEW"
              ? "border-2 border-amber-500 bg-amber-50/60 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Review
              </p>
              {statusFilter === "SUBMITTED" || statusFilter === "UNDER_REVIEW" ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {pendingCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click to filter pending
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* Serving Notice Card */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("team");
            setStatusFilter((prev) => (prev === "APPROVED" ? "" : "APPROVED"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "APPROVED"
              ? "border-2 border-[#0284c7] bg-sky-50/60 shadow-md ring-2 ring-sky-500/20 dark:border-sky-400 dark:bg-sky-950/30"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-[#0284c7] hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284c7] dark:text-sky-300">
                Serving Notice
              </p>
              {statusFilter === "APPROVED" ? (
                <span className="rounded-full bg-[#0284c7]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#0284c7] dark:text-sky-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0284c7] dark:text-sky-300">
              {inNoticeCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click to filter active notice
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-[#0284c7] transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <Calendar className="h-5 w-5" />
          </div>
        </button>

        {/* Completed Exits Card */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("team");
            setStatusFilter((prev) => (prev === "COMPLETED" ? "" : "COMPLETED"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            statusFilter === "COMPLETED"
              ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Completed Exits
              </p>
              {statusFilter === "COMPLETED" ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {completedCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click to filter completed
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* Tabs with Spring Glide Indicator Pill */}
      {tabs.length > 1 ? (
        <Tabs
          label="Exit Request Sections"
          idPrefix="exit-requests"
          tabs={tabs}
          value={activeTab}
          onChange={(id) => setActiveTab(id as "team" | "mine")}
        />
      ) : null}

      {/* Tab Content: Team & Organization Queue */}
      {activeTab === "team" && canReadAny ? (
        <div className="flex flex-col gap-5">
          {/* Search and Filters Bar */}
          <div className="rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-700/80 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by employee name, code, or reason..."
                    className="w-full rounded-xl border border-sky-200/90 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-[#0a3271] placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        setPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Status Filter */}
                <div className="w-full sm:w-52">
                  <Select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as "" | ExitRequestStatus);
                      setPage(1);
                    }}
                    className="rounded-xl border border-sky-200/90 bg-white text-xs font-semibold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    {EXIT_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-brand-500 hover:text-[#0a3271]"
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          {/* Cards List or States */}
          {teamRequestsQuery.isPending ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          ) : teamRequestsQuery.isError ? (
            teamRequestsQuery.error instanceof ApiError &&
            teamRequestsQuery.error.isPermissionError ? (
              <Alert
                variant="warning"
                title="You don't have access to exit requests"
              >
                Your access to this list has changed. Contact an administrator.
              </Alert>
            ) : (
              <ErrorState onRetry={() => void teamRequestsQuery.refetch()} />
            )
          ) : teamRequestsQuery.data.data.length === 0 ? (
            <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
              <EmptyState
                title={
                  hasFilters
                    ? "No requests match these filters"
                    : "No exit requests recorded yet"
                }
                description={
                  hasFilters
                    ? "Try adjusting your search terms or status filter."
                    : "Employee resignations and offboarding requests will appear here."
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearFilters}
                      className="mt-2 text-xs font-bold text-brand-500"
                    >
                      Clear search filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {teamRequestsQuery.data.data.map((req) => (
                <ExitRequestCard
                  key={req.id}
                  request={req}
                  canDecide={canDecide}
                  onUpdated={() => void teamRequestsQuery.refetch()}
                />
              ))}

              <div className="mt-2">
                <Pagination
                  page={teamRequestsQuery.data.meta.page}
                  totalPages={teamRequestsQuery.data.meta.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Tab Content: My Exit Requests */}
      {activeTab === "mine" && canReadMine ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-theme-sm font-bold text-[#0a3271] dark:text-sky-100">
              My Exit & Resignation History
            </h2>
            {canCreateMine ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSubmitOpen(true)}
                disabled={hasActiveMyRequest}
                className="rounded-xl border border-sky-200/90 bg-white text-xs font-bold text-[#0a3271] hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Raise Exit Request
              </Button>
            ) : null}
          </div>

          {myRequestsQuery.isPending ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          ) : myRequestsQuery.isError ? (
            <ErrorState onRetry={() => void myRequestsQuery.refetch()} />
          ) : myRequestsQuery.data.data.length === 0 ? (
            <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
              <EmptyState
                title="No exit requests submitted"
                description={
                  canCreateMine
                    ? "If you wish to submit your resignation, click 'Raise Exit Request'."
                    : "Your personal exit request history will appear here."
                }
                action={
                  canCreateMine && !hasActiveMyRequest ? (
                    <Button
                      onClick={() => setSubmitOpen(true)}
                      className="mt-3 rounded-xl bg-brand-500 text-xs font-bold text-white hover:bg-[#0284c7]"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Raise Exit Request
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {myRequestsQuery.data.data.map((req) => (
                <ExitRequestCard
                  key={req.id}
                  request={req}
                  canDecide={false}
                  onUpdated={() => void myRequestsQuery.refetch()}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Raise Exit Request Dialog */}
      {submitOpen ? (
        <SubmitExitRequestDialog
          open
          onClose={() => {
            setSubmitOpen(false);
            void myRequestsQuery.refetch();
            void teamRequestsQuery.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
