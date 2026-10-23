"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { HrPageHeader } from "@/features/hr/components";
import {
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useCreateMyExpenseClaim, useMyExpenseClaims } from "../hooks";
import { EXPENSE_TYPES, type MyExpenseClaim } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
};

function formatCurrency(val: number | string) {
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

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

function NewExpenseClaimForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExpenseClaim();
  const { toast } = useToast();
  const [expenseType, setExpenseType] = useState<
    (typeof EXPENSE_TYPES)[number]
  >(EXPENSE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<string>(() =>
    new Date().toISOString().substring(0, 10),
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        expenseType,
        amount: Number(amount),
        expenseDate,
        description,
      });
      toast({ title: "Expense claim submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this claim. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Expense Type" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={expenseType}
            onChange={(e) =>
              setExpenseType(e.target.value as (typeof EXPENSE_TYPES)[number])
            }
            required
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Amount (₹)" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="Expense Date" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          )}
        </FormField>
      </div>
      <FormField label="Purpose / Description" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            placeholder="e.g. Travel tickets to client meeting in Mumbai"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={300}
          />
        )}
      </FormField>
      {error ? (
        <Alert variant="error" title="Submission failed">
          {error}
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2 pt-2 border-t border-sky-100 dark:border-slate-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Submit claim
        </Button>
      </div>
    </form>
  );
}

export function MyExpenseClaimsView() {
  const query = useMyExpenseClaims();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearchParams();
  const targetClaimId = searchParams?.get("id") || searchParams?.get("claimId");

  const rows = query.data ?? [];

  useEffect(() => {
    if (targetClaimId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`claim-row-${targetClaimId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetClaimId, rows]);

  // Summary statistics
  const summary = useMemo(() => {
    let totalClaimed = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;

    for (const claim of rows) {
      const amt = Number(claim.amount) || 0;
      totalClaimed += amt;
      if (claim.status === "APPROVED") {
        approvedAmount += amt;
      } else if (claim.status === "PENDING") {
        pendingAmount += amt;
        pendingCount += 1;
      }
    }

    return {
      totalCount: rows.length,
      totalClaimed,
      approvedAmount,
      pendingAmount,
      pendingCount,
    };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesType = r.expenseType.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesAmt = r.amount.toString().includes(q);
        if (!matchesType && !matchesDesc && !matchesAmt) return false;
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const hasFilters = statusFilter !== "" || searchQuery !== "";

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4 animate-reveal">
        <div className="h-28 w-full rounded-2xl bg-sky-100/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to expense claims"
        >
          Ask an administrator for permission to access expense claims.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const metricCards = [
    {
      label: "Total Claims",
      value: summary.totalCount.toString(),
      subtext: `${formatCurrency(summary.totalClaimed)} submitted`,
      Icon: Receipt,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
      filterValue: "",
    },
    {
      label: "Approved Claims",
      value: formatCurrency(summary.approvedAmount),
      subtext: "Reimbursable / Approved",
      Icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
      filterValue: "APPROVED",
    },
    {
      label: "Pending Review",
      value: formatCurrency(summary.pendingAmount),
      subtext: `${summary.pendingCount} pending approvals`,
      Icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
      filterValue: "PENDING",
    },
    {
      label: "Total Claimed",
      value: formatCurrency(summary.totalClaimed),
      subtext: "Lifetime sum",
      Icon: IndianRupee,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
      filterValue: "",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Page Header with 3D Expenses Icon */}
      <HrPageHeader
        title="Expense Claims"
        description="Submit business reimbursement claims, track review status, and monitor payout approvals."
        icon3d="expenses"
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl font-bold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Submit claim</span>
          </Button>
        }
      />

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => {
          const isSelected =
            card.filterValue !== "" && statusFilter === card.filterValue;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (card.filterValue) {
                  setStatusFilter((prev) =>
                    prev === card.filterValue ? "" : card.filterValue,
                  );
                }
              }}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all ${
                card.filterValue ? "cursor-pointer" : "cursor-default"
              } ${
                isSelected
                  ? "border-2 border-brand-500 bg-sky-50/80 shadow-xs ring-2 ring-brand-500/15 dark:bg-slate-800"
                  : "border border-sky-200/90 bg-white hover:border-brand-300 hover:bg-sky-50/40 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
              >
                <card.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                  {card.value}
                </span>
                <span className="block text-[11px] font-medium text-slate-400 truncate">
                  {card.subtext}
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
            aria-label="Search claims"
            placeholder="Search by description or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending Review</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Table / Content */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={hasFilters ? "No matching claims" : "No expense claims yet"}
            description={
              hasFilters
                ? "Try clearing the search or status filter to see all claims."
                : "Submit a reimbursement claim for business or travel expenses."
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable<MyExpenseClaim>
            className="border-0 shadow-none rounded-none"
            columns={[
              {
                header: "Expense Details",
                cell: (row) => {
                  const isHighlighted =
                    targetClaimId && String(row.id) === targetClaimId;
                  return (
                    <div
                      id={`claim-row-${row.id}`}
                      className={`flex flex-col gap-1 py-1 transition-all ${
                        isHighlighted
                          ? "rounded-xl border border-brand-300 bg-sky-50/80 p-2 dark:border-sky-700 dark:bg-sky-950/60 ring-2 ring-[#1769F5]/40"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0a3271] dark:text-white">
                          {row.description || row.expenseType}
                        </span>
                        {isHighlighted && (
                          <span className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                          {row.expenseType}
                        </span>
                      </div>
                    </div>
                  );
                },
              },
              {
                header: "Amount",
                cell: (row) => (
                  <span className="font-bold text-base text-[#0a3271] dark:text-white">
                    {formatCurrency(row.amount)}
                  </span>
                ),
              },
              {
                header: "Date",
                cell: (row) => (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDate(row.expenseDate)}</span>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (row) => (
                  <StatusBadge
                    label={row.status}
                    colorToken={STATUS_TOKEN[row.status] ?? "gray"}
                  />
                ),
              },
            ]}
            rows={filteredRows}
            getRowKey={(row) => String(row.id)}
          />
        </div>
      )}

      {/* 5. Create Claim Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Submit Expense Claim"
      >
        <NewExpenseClaimForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
