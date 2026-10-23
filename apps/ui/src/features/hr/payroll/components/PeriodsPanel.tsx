"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Lock,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { periodLabel } from "../format";
import { usePeriods } from "../hooks";
import { PAYROLL_WRITE } from "../permissions";
import {
  PERIOD_STATUSES,
  type PayrollPeriod,
  type PeriodStatus,
} from "../types";
import { PeriodCard } from "./PeriodCard";
import { CreatePeriodDialog } from "./PeriodDialogs";
import { periodStatusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

export function PeriodsPanel() {
  const canWrite = usePermission(PAYROLL_WRITE);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState<number | "">(CURRENT_YEAR);
  const [status, setStatus] = useState<PeriodStatus | "">("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Summary query across all statuses for the active year to power KPI metric cards
  const summaryQuery = usePeriods({
    page: 1,
    limit: 50,
    ...(year ? { year } : {}),
  });

  // Filtered periods query
  const query = usePeriods({
    page,
    limit: PAGE_SIZE,
    ...(year ? { year } : {}),
    ...(status ? { status } : {}),
  });

  const rawRows = query.data?.data ?? [];

  // Filter client-side by search query (matching period name or dates)
  const rows = useMemo(() => {
    if (!search.trim()) return rawRows;
    const q = search.trim().toLowerCase();
    return rawRows.filter((p) => {
      const label = periodLabel(p).toLowerCase();
      const yearStr = String(p.year);
      const start = p.periodStart.toLowerCase();
      const end = p.periodEnd.toLowerCase();
      return (
        label.includes(q) ||
        yearStr.includes(q) ||
        start.includes(q) ||
        end.includes(q)
      );
    });
  }, [rawRows, search]);

  // KPI Metrics calculation
  const { totalPeriods, draftCount, reviewCount, finalizedCount } =
    useMemo(() => {
      const items = summaryQuery.data?.data ?? [];
      const total = summaryQuery.data?.meta?.total ?? items.length;
      const draft = items.filter(
        (p) => p.status === "DRAFT" || p.status === "REOPENED",
      ).length;
      const review = items.filter(
        (p) =>
          p.status === "PROCESSING" ||
          p.status === "PROCESSED" ||
          p.status === "APPROVED",
      ).length;
      const finalized = items.filter((p) => p.status === "FINALIZED").length;

      return {
        totalPeriods: total,
        draftCount: draft,
        reviewCount: review,
        finalizedCount: finalized,
      };
    }, [summaryQuery.data]);

  const hasFilters = status !== "" || search !== "" || year !== CURRENT_YEAR;

  const handleClearFilters = () => {
    setStatus("");
    setSearch("");
    setYear(CURRENT_YEAR);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5 animate-reveal">
      {/* 4 Interactive Metric KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Periods Card */}
        <button
          type="button"
          onClick={() => {
            setStatus("");
            setSearch("");
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "" && search === ""
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Periods
              </p>
              {status === "" && search === "" ? (
                <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-sky-300">
                  Active
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalPeriods}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {year ? `All cycles in ${year}` : "All cycles across years"}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <Calendar className="h-5 w-5" />
          </div>
        </button>

        {/* Draft & Open Card */}
        <button
          type="button"
          onClick={() => {
            setStatus((prev) => (prev === "DRAFT" ? "" : "DRAFT"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "DRAFT" || status === "REOPENED"
              ? "border-2 border-amber-500 bg-amber-50/60 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Draft & Open
              </p>
              {status === "DRAFT" || status === "REOPENED" ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {draftCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Pending run calculation
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* Processing & In Review Card */}
        <button
          type="button"
          onClick={() => {
            setStatus((prev) => (prev === "PROCESSED" ? "" : "PROCESSED"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "PROCESSING" ||
            status === "PROCESSED" ||
            status === "APPROVED"
              ? "border-2 border-brand-500 bg-sky-50/60 shadow-md ring-2 ring-brand-500/20 dark:border-sky-400 dark:bg-sky-950/30"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-sky-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-sky-300">
                In Review & Approval
              </p>
              {status === "PROCESSING" ||
              status === "PROCESSED" ||
              status === "APPROVED" ? (
                <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-sky-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-400">
              {reviewCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Maker-checker in progress
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-600 transition-transform group-hover:scale-105 dark:border-sky-900 dark:bg-sky-950/40">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </button>

        {/* Finalized & Settled Card */}
        <button
          type="button"
          onClick={() => {
            setStatus((prev) => (prev === "FINALIZED" ? "" : "FINALIZED"));
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "FINALIZED"
              ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
              : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Finalized & Locked
              </p>
              {status === "FINALIZED" ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  Active Filter
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {finalizedCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Payslips generated & locked
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Lock className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* Filter and Action Toolbar */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search & Select Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search month or year..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Year Selector */}
            <Select
              aria-label="Filter by year"
              className="w-36"
              value={year}
              onChange={(e) => {
                setYear(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>

            {/* Status Selector */}
            <Select
              aria-label="Filter by status"
              className="w-full sm:w-44"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PeriodStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {PERIOD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {periodStatusLabel(s)}
                </option>
              ))}
            </Select>

            {/* Reset Button */}
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-slate-500 hover:text-brand-600"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          {/* New Period Trigger Button */}
          {canWrite ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Period
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Query Status / Error Banner */}
      <QueryState query={query} area="payroll periods" />

      {/* Empty State */}
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No payroll periods found"
            description={
              hasFilters
                ? "No payroll periods match your selected filter criteria. Try resetting filters."
                : canWrite
                  ? "Create a new payroll period to calculate pay for this month."
                  : "No payroll periods have been created yet."
            }
            action={
              hasFilters ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleClearFilters}
                >
                  Reset filters
                </Button>
              ) : canWrite ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Period
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : null}

      {/* Interactive Period Cards List */}
      {query.isSuccess && rows.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {rows.map((period) => (
            <PeriodCard
              key={period.id}
              period={period}
              isExpanded={selectedId === period.id}
              onToggleExpand={() =>
                setSelectedId(selectedId === period.id ? null : period.id)
              }
            />
          ))}

          {/* Pagination Controls */}
          <div className="pt-2">
            <Pagination
              page={page}
              totalPages={query.data?.meta?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </div>
        </div>
      ) : null}

      {/* Create Period Modal */}
      {createOpen ? (
        <CreatePeriodDialog
          open
          onClose={() => setCreateOpen(false)}
          onCreated={(p) => {
            setYear(p.year);
            setStatus("");
            setSearch("");
            setPage(1);
            setSelectedId(p.id);
          }}
        />
      ) : null}
    </div>
  );
}
