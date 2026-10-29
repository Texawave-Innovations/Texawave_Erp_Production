"use client";

import { useMemo, useState } from "react";
import type {
  CreateExpenseFromClaimInput,
  CreateFinanceExpenseInput,
  FinanceExpense,
  FinanceExpenseStatus,
  QueryFinanceExpensesInput,
  RecordExpensePaymentInput,
  UpdateFinanceExpenseInput,
} from "@texawave-erp/api-types";
import { FINANCE_EXPENSE_STATUSES } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  ArrowRight,
  Ban,
  Check,
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { useExpenseClaims } from "@/features/hr/expense-approvals/hooks";
import type { ExpenseClaimItem } from "@/features/hr/expense-approvals/types";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "../../shared/format";
import {
  useApproveExpense,
  useCancelExpense,
  useCreateExpense,
  useCreateExpenseFromClaim,
  useDeleteExpense,
  useExpenses,
  usePayExpense,
  useSubmitExpense,
  useUpdateExpense,
} from "../hooks";
import { FINANCE_EXPENSE_READ, FINANCE_EXPENSE_WRITE } from "../permissions";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { ConvertClaimDialog } from "./ConvertClaimDialog";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { ExpenseDetailDialog } from "./ExpenseDetailDialog";
import { ExpensesSummaryBanner } from "./ExpensesSummaryBanner";
import { ExpenseStatusBadge } from "./ExpenseStatusBadge";
import { PayExpenseDialog } from "./PayExpenseDialog";

const PAGE_SIZE = 15;

export function ExpensesView() {
  const canRead = usePermission(FINANCE_EXPENSE_READ);
  const canWrite = usePermission(FINANCE_EXPENSE_WRITE);

  // Active sub-tab: "business" | "claims"
  const [activeTab, setActiveTab] = useState<"business" | "claims">("business");

  // Filters for Business Expenses
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<
    FinanceExpenseStatus | "ALL"
  >("ALL");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [expenseMonth, setExpenseMonth] = useState("");

  // Pagination for Employee Claims tab
  const [claimsPage, setClaimsPage] = useState(1);

  // Dialogs State
  const [createOpen, setCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceExpense | null>(
    null,
  );
  const [payingExpense, setPayingExpense] = useState<FinanceExpense | null>(
    null,
  );
  const [selectedExpense, setSelectedExpense] = useState<FinanceExpense | null>(
    null,
  );
  const [submittingExpense, setSubmittingExpense] =
    useState<FinanceExpense | null>(null);
  const [approvingExpense, setApprovingExpense] =
    useState<FinanceExpense | null>(null);
  const [cancellingExpense, setCancellingExpense] =
    useState<FinanceExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<FinanceExpense | null>(
    null,
  );
  const [convertingClaim, setConvertingClaim] =
    useState<ExpenseClaimItem | null>(null);

  const { toast } = useToast();

  // Convert expenseMonth (YYYY-MM) to server-supported startDate and endDate
  const dateRange = useMemo(() => {
    if (!expenseMonth) return {};
    const [year, month] = expenseMonth.split("-").map(Number);
    if (!year || !month) return {};
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate: start, endDate: end };
  }, [expenseMonth]);

  const queryParams = useMemo<QueryFinanceExpensesInput>(() => {
    return {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(categoryFilter ? { expenseTypeId: Number(categoryFilter) } : {}),
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    };
  }, [page, debouncedSearch, statusFilter, categoryFilter, dateRange]);

  // Queries
  const expensesQuery = useExpenses(queryParams);
  const claimsQuery = useExpenseClaims({
    page: claimsPage,
    limit: PAGE_SIZE,
    status: "APPROVED",
  });
  const categoriesQuery = useMasterListItems({
    category: "expense_type",
    limit: 100,
  });

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data?.data],
  );

  const pendingClaimsCount = claimsQuery.data?.meta?.total ?? 0;

  // Mutations
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const submitMutation = useSubmitExpense();
  const approveMutation = useApproveExpense();
  const payMutation = usePayExpense();
  const cancelMutation = useCancelExpense();
  const convertClaimMutation = useCreateExpenseFromClaim();
  const deleteMutation = useDeleteExpense();

  // Handlers
  const handleCreateSubmit = async (values: CreateFinanceExpenseInput) => {
    try {
      await createMutation.mutateAsync(values);
      toast({
        title:
          values.status === "PAID"
            ? "Expense recorded & posted to General Ledger"
            : "Expense saved as draft",
        variant: "success",
      });
      void expensesQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to record expense. Please check input values.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleUpdateSubmit = async (
    id: number,
    values: UpdateFinanceExpenseInput,
  ) => {
    try {
      await updateMutation.mutateAsync({ id, input: values });
      toast({
        title: "Expense updated successfully",
        variant: "success",
      });
      setEditingExpense(null);
      void expensesQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to update expense.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handlePaySubmit = async (
    id: number,
    values: RecordExpensePaymentInput,
  ) => {
    try {
      await payMutation.mutateAsync({ id, input: values });
      toast({
        title: "Payment disbursed & posted to General Ledger",
        variant: "success",
      });
      setPayingExpense(null);
      if (selectedExpense?.id === id) {
        setSelectedExpense(null);
      }
      void expensesQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to disburse payment.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleConvertClaimSubmit = async (
    claimId: number,
    values: CreateExpenseFromClaimInput,
  ) => {
    try {
      const created = await convertClaimMutation.mutateAsync({
        claimId,
        input: values,
      });
      toast({
        title: `Claim converted to expense #${created.expenseNumber}`,
        variant: "success",
      });
      setConvertingClaim(null);
      void claimsQuery.refetch();
      void expensesQuery.refetch();
      setActiveTab("business");
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to convert claim to expense.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleSubmitAction = async () => {
    if (!submittingExpense) return;
    try {
      await submitMutation.mutateAsync(submittingExpense.id);
      toast({
        title: `Expense ${submittingExpense.expenseNumber} submitted for approval`,
        variant: "success",
      });
      setSubmittingExpense(null);
      void expensesQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to submit expense",
        variant: "error",
      });
    }
  };

  const handleApproveAction = async () => {
    if (!approvingExpense) return;
    try {
      await approveMutation.mutateAsync(approvingExpense.id);
      toast({
        title: `Expense ${approvingExpense.expenseNumber} approved`,
        variant: "success",
      });
      setApprovingExpense(null);
      void expensesQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to approve expense",
        variant: "error",
      });
    }
  };

  const handleCancelAction = async () => {
    if (!cancellingExpense) return;
    try {
      await cancelMutation.mutateAsync(cancellingExpense.id);
      toast({
        title: `Expense ${cancellingExpense.expenseNumber} cancelled`,
        variant: "success",
      });
      setCancellingExpense(null);
      if (selectedExpense?.id === cancellingExpense.id) {
        setSelectedExpense(null);
      }
      void expensesQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to cancel expense",
        variant: "error",
      });
    }
  };

  const handleDeleteAction = async () => {
    if (!deletingExpense) return;
    try {
      await deleteMutation.mutateAsync(deletingExpense.id);
      toast({
        title: `Expense ${deletingExpense.expenseNumber} deleted`,
        variant: "success",
      });
      setDeletingExpense(null);
      void expensesQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete expense",
        variant: "error",
      });
    }
  };

  // Business Expenses columns
  const businessColumns: DataTableColumn<FinanceExpense>[] = [
    {
      header: "EXPENSE #",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedExpense(row)}
          className="font-bold text-theme-sm text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left"
        >
          {row.expenseNumber}
        </button>
      ),
    },
    {
      header: "DATE",
      sortable: true,
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.expenseDate)}
        </span>
      ),
    },
    {
      header: "CATEGORY",
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-theme-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/40">
          {row.expenseType?.value || "General"}
        </span>
      ),
    },
    {
      header: "VENDOR / PAYEE",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {row.vendorName || "—"}
        </span>
      ),
    },
    {
      header: "AMOUNT (₹)",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.netAmount || row.amount)}
        </span>
      ),
    },
    {
      header: "PAID THROUGH",
      cell: (row) => (
        <div className="flex flex-col text-theme-xs">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {row.paymentMode?.value || "—"}
          </span>
          {row.bankAccount && (
            <span className="text-gray-500 dark:text-gray-400">
              {row.bankAccount.bankName} (
              {row.bankAccount.accountNumber.slice(-4)})
            </span>
          )}
        </div>
      ),
    },
    {
      header: "GL VOUCHER",
      cell: (row) =>
        row.journalEntry ? (
          <Link
            href="/finance/journal-entries"
            className="inline-flex items-center gap-1 text-theme-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            {row.journalEntry.entryNumber}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-theme-xs text-gray-400">—</span>
        ),
    },
    {
      header: "STATUS",
      cell: (row) => <ExpenseStatusBadge status={row.status} />,
    },
    {
      header: "ACTIONS",
      cell: (row) => {
        const isDraft = row.status === "DRAFT";
        const isPending = row.status === "PENDING_APPROVAL";
        const isApproved = row.status === "APPROVED";
        const isCancelled = row.status === "CANCELLED";

        return (
          <div className="flex items-center justify-end gap-1">
            <ActionMenu
              ariaLabel={`Actions for ${row.expenseNumber}`}
              items={[
                {
                  label: "View Details",
                  icon: <Eye className="h-4 w-4" />,
                  onClick: () => setSelectedExpense(row),
                },
                ...(canWrite && (isDraft || isPending || isApproved)
                  ? [
                      {
                        label: "Disburse Payment",
                        icon: <Wallet className="h-4 w-4 text-emerald-600" />,
                        onClick: () => setPayingExpense(row),
                      },
                    ]
                  : []),
                ...(canWrite && (isDraft || isPending)
                  ? [
                      {
                        label: "Edit Expense",
                        icon: <Pencil className="h-4 w-4" />,
                        onClick: () => setEditingExpense(row),
                      },
                    ]
                  : []),
                ...(canWrite && isDraft
                  ? [
                      {
                        label: "Submit for Approval",
                        icon: <Check className="h-4 w-4 text-sky-600" />,
                        onClick: () => setSubmittingExpense(row),
                      },
                    ]
                  : []),
                ...(canWrite && isPending
                  ? [
                      {
                        label: "Approve Expense",
                        icon: <Check className="h-4 w-4 text-emerald-600" />,
                        onClick: () => setApprovingExpense(row),
                      },
                    ]
                  : []),
                ...(canWrite && !isCancelled
                  ? [
                      {
                        label: "Cancel Expense",
                        icon: <Ban className="h-4 w-4 text-rose-600" />,
                        onClick: () => setCancellingExpense(row),
                      },
                    ]
                  : []),
                ...(canWrite && (isDraft || isCancelled)
                  ? [
                      {
                        label: "Delete Expense",
                        icon: <Trash2 className="h-4 w-4 text-rose-600" />,
                        onClick: () => setDeletingExpense(row),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        );
      },
    },
  ];

  // Employee Claims columns
  const claimsColumns: DataTableColumn<ExpenseClaimItem>[] = [
    {
      header: "CLAIM ID",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          #{row.id}
        </span>
      ),
    },
    {
      header: "EMPLOYEE",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
            {row.employee.fullName}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            ID: #{row.employee.id}
          </span>
        </div>
      ),
    },
    {
      header: "CATEGORY",
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-theme-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40">
          {row.expenseType}
        </span>
      ),
    },
    {
      header: "DATE",
      sortable: true,
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.expenseDate)}
        </span>
      ),
    },
    {
      header: "APPROVED AMOUNT (₹)",
      sortable: true,
      cell: (row) => (
        <span className="font-bold text-theme-sm text-blue-700 dark:text-sky-400">
          {formatMoney(row.amount)}
        </span>
      ),
    },
    {
      header: "DESCRIPTION",
      cell: (row) => (
        <span className="text-theme-xs text-gray-600 dark:text-gray-300 line-clamp-1 max-w-xs">
          {row.description || "—"}
        </span>
      ),
    },
    {
      header: "ACTIONS",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-sky-400 dark:border-blue-900/50"
              onClick={() => setConvertingClaim(row)}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              Convert to Expense
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!canRead) {
    return (
      <div className="p-6">
        <EmptyState
          title="Access Denied"
          description="You do not have permission to view operational expenses."
        />
      </div>
    );
  }

  const expensesData = expensesQuery.data?.data ?? [];
  const expensesMeta = expensesQuery.data?.meta;
  const claimsData = claimsQuery.data?.data ?? [];
  const claimsMeta = claimsQuery.data?.meta;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative focus-within:z-30">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Expenses
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Track business overheads, disburse employee claims, and verify
            ledger postings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
              className="shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Dual Operational Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab("business")}
          className={`flex items-center gap-2 pb-3 px-3 text-theme-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "business"
              ? "border-blue-600 text-blue-600 dark:border-sky-400 dark:text-sky-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Business Expenses</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 pb-3 px-3 text-theme-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "claims"
              ? "border-blue-600 text-blue-600 dark:border-sky-400 dark:text-sky-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Employee Claims</span>
          {pendingClaimsCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-theme-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {pendingClaimsCount}
            </span>
          )}
        </button>
      </div>

      {/* Business Expenses Tab Content */}
      {activeTab === "business" && (
        <div className="flex flex-col gap-5">
          {/* Summary Banner */}
          <ExpensesSummaryBanner
            expenses={expensesData}
            totalServerCount={expensesMeta?.total}
          />

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/80 dark:bg-gray-900/60 dark:border-gray-800 shadow-xs relative focus-within:z-30">
            <div className="flex-1 min-w-[240px] max-w-md">
              <SearchInput
                placeholder="Search by category, vendor, notes..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Category Filter */}
              <div className="w-44">
                <Select
                  value={categoryFilter ? String(categoryFilter) : ""}
                  onChange={(e) => {
                    setCategoryFilter(
                      e.target.value ? Number(e.target.value) : "",
                    );
                    setPage(1);
                  }}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.value}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(
                      e.target.value as FinanceExpenseStatus | "ALL",
                    );
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  {FINANCE_EXPENSE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Incurred Month Filter */}
              <div className="w-38">
                <Input
                  type="month"
                  value={expenseMonth}
                  onChange={(e) => {
                    setExpenseMonth(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {(searchTerm ||
                statusFilter !== "ALL" ||
                categoryFilter !== "" ||
                expenseMonth) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("ALL");
                    setCategoryFilter("");
                    setExpenseMonth("");
                    setPage(1);
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Data Table */}
          {expensesQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
              <span className="text-theme-sm text-gray-500">
                Loading operational expenses...
              </span>
            </div>
          ) : expensesQuery.isError ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
              <ErrorState
                title="Failed to Load Operational Expenses"
                description={
                  expensesQuery.error instanceof Error
                    ? expensesQuery.error.message
                    : "An unexpected error occurred while fetching expense records."
                }
                onRetry={() => void expensesQuery.refetch()}
              />
            </div>
          ) : expensesData.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
              <EmptyState
                title="No expenses found"
                description={
                  searchTerm ||
                  statusFilter !== "ALL" ||
                  categoryFilter ||
                  expenseMonth
                    ? "No operational expenses match your current search and active filters."
                    : "No operating expenses recorded yet. Click 'Add Expense' to record your first expense overhead."
                }
                action={
                  canWrite && !searchTerm ? (
                    <Button
                      onClick={() => setCreateOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Expense</span>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:bg-gray-900/60 dark:border-gray-800 shadow-xs relative focus-within:z-30">
              <DataTable
                columns={businessColumns}
                rows={expensesData}
                getRowKey={(row) => String(row.id)}
              />

              {expensesMeta && expensesMeta.totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                  <Pagination
                    page={page}
                    totalPages={expensesMeta.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Employee Claims Tab Content */}
      {activeTab === "claims" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-blue-50/70 p-4 border border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
                  Approved Employee Claims Awaiting Reimbursement
                </h3>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Review claims approved by department heads and convert them
                  into official Finance operating expenses for GL posting and
                  bank disbursement.
                </p>
              </div>
            </div>
          </div>

          {claimsQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
              <span className="text-theme-sm text-gray-500">
                Loading employee claims...
              </span>
            </div>
          ) : claimsQuery.isError ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
              <ErrorState
                title="Failed to Load Employee Claims"
                description={
                  claimsQuery.error instanceof Error
                    ? claimsQuery.error.message
                    : "An unexpected error occurred while fetching approved employee claims."
                }
                onRetry={() => void claimsQuery.refetch()}
              />
            </div>
          ) : claimsData.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
              <EmptyState
                title="No approved claims pending"
                description="All approved employee claims have been converted or none are currently submitted."
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:bg-gray-900/60 dark:border-gray-800 shadow-xs relative focus-within:z-30">
              <DataTable
                columns={claimsColumns}
                rows={claimsData}
                getRowKey={(row) => String(row.id)}
              />

              {claimsMeta && claimsMeta.totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                  <Pagination
                    page={claimsPage}
                    totalPages={claimsMeta.totalPages}
                    onPageChange={setClaimsPage}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AddExpenseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <EditExpenseDialog
        expense={editingExpense}
        open={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleUpdateSubmit}
      />

      <PayExpenseDialog
        expense={payingExpense}
        open={Boolean(payingExpense)}
        onClose={() => setPayingExpense(null)}
        onSubmit={handlePaySubmit}
      />

      <ConvertClaimDialog
        claim={convertingClaim}
        open={Boolean(convertingClaim)}
        onClose={() => setConvertingClaim(null)}
        onSubmit={handleConvertClaimSubmit}
      />

      <ExpenseDetailDialog
        open={Boolean(selectedExpense)}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        canWrite={canWrite}
        onPayClick={(exp) => setPayingExpense(exp)}
        onEditClick={(exp) => setEditingExpense(exp)}
        onCancelClick={(exp) => setCancellingExpense(exp)}
      />

      {/* Confirm Action Modals */}
      <ConfirmDialog
        open={Boolean(submittingExpense)}
        onClose={() => setSubmittingExpense(null)}
        onConfirm={handleSubmitAction}
        title="Submit Expense for Approval"
        itemName={submittingExpense?.expenseNumber}
        description={
          <span>
            Are you sure you want to submit expense{" "}
            <strong>{submittingExpense?.expenseNumber}</strong> for managerial
            approval?
          </span>
        }
        confirmText="Submit Expense"
      />

      <ConfirmDialog
        open={Boolean(approvingExpense)}
        onClose={() => setApprovingExpense(null)}
        onConfirm={handleApproveAction}
        title="Approve Operating Expense"
        itemName={approvingExpense?.expenseNumber}
        description={
          <span>
            Are you sure you want to approve expense{" "}
            <strong>{approvingExpense?.expenseNumber}</strong>? It will be ready
            for payment disbursement.
          </span>
        }
        confirmText="Approve Expense"
      />

      <ConfirmDialog
        open={Boolean(cancellingExpense)}
        onClose={() => setCancellingExpense(null)}
        onConfirm={handleCancelAction}
        title="Cancel Operating Expense"
        itemName={cancellingExpense?.expenseNumber}
        description={
          <span>
            Are you sure you want to cancel expense{" "}
            <strong>{cancellingExpense?.expenseNumber}</strong>? If already
            paid, an atomic GL reversal voucher will be generated.
          </span>
        }
        confirmText="Cancel Expense"
        variant="destructive"
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteAction}
        title="Delete Operating Expense"
        itemName={deletingExpense?.expenseNumber}
        description={
          <span>
            Are you sure you want to soft delete expense{" "}
            <strong>{deletingExpense?.expenseNumber}</strong>? This action
            cannot be undone.
          </span>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
