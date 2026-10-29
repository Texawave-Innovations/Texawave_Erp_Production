"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, formatCurrency, formatDate } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  Ban,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  Eye,
  HeartPulse,
  Layers,
  Plane,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Table,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import { useEmployees } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  useDecideExpenseClaim,
  useExpenseClaims,
  useMyExpenseClaims,
} from "../hooks";
import {
  DECIDE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
  SELF_SERVICE_READ,
} from "../permissions";
import { STATUS_LABELS } from "../status";
import {
  EXPENSE_CLAIM_STATUSES,
  EXPENSE_TYPES,
  type ExpenseClaimItem,
  type ExpenseClaimStatus,
  type ExpenseType,
} from "../types";
import { DecideExpenseClaimDialog } from "./DecideExpenseClaimDialog";
import { ExpenseClaimDetailsDialog } from "./ExpenseClaimDetailsDialog";
import { ExpenseClaimStatusBadge } from "./ExpenseClaimStatusBadge";
import { SubmitExpenseClaimDialog } from "./SubmitExpenseClaimDialog";

const PAGE_SIZE = 10;

type TabKey = "mine" | "team";
type ViewMode = "grouped" | "table";

interface Filters {
  status: "" | ExpenseClaimStatus;
  expenseType: "" | ExpenseType;
  search: string;
}

const EMPTY_FILTERS: Filters = { status: "", expenseType: "", search: "" };

type DecisionState = {
  claim: ExpenseClaimItem;
  decision: "APPROVED" | "REJECTED";
} | null;

function formatIndianCurrency(amount: number): string {
  try {
    return formatCurrency(amount);
  } catch {
    return `₹ ${amount.toFixed(2)}`;
  }
}

function formatExpenseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const formatted = formatDate(dateStr);
    return formatted || dateStr;
  } catch {
    return dateStr;
  }
}

function describeDecideError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_APPROVAL_FORBIDDEN") {
      return "You cannot approve or reject your own expense claim.";
    }
    if (error.errorCode === "DECISION_SCOPE_REQUIRED") {
      return "Deciding a claim requires team or organization scope.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to decide this expense claim.";
    }
    if (error.statusCode === 404) {
      return "This expense claim is no longer in your approval queue.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This claim has already been decided.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the character limit and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function getExpenseTypeIcon(type: ExpenseType) {
  switch (type) {
    case "Travel":
      return Plane;
    case "Food":
      return Utensils;
    case "Accommodation":
      return Building2;
    case "Office Supplies":
      return Briefcase;
    case "Medical":
      return HeartPulse;
    case "Other":
    default:
      return Receipt;
  }
}

interface TableClaimItem extends ExpenseClaimItem {
  rowNumber: number;
}

/**
 * Enhanced Enterprise Expense Approvals View
 * Features:
 * 1. 2-Tier Financial Metrics (Status Counts + Total Rupee ₹ Amounts + Category Breakdown Cards)
 * 2. Grouped Category Accordion View (Reference 3 Inspiration with Inline Decision Notes)
 * 3. Dense Table View Toggle
 * 4. 1-Click Excel / CSV Export
 * 5. Full Self-Service & Team Scoped Approvals
 */
export function ExpenseApprovalsView() {
  const searchParams = useSearchParams();
  const urlClaimId = searchParams.get("id") || searchParams.get("claimId");

  const hasSelfServiceRead = usePermission(SELF_SERVICE_READ);
  const hasSelfServiceCreate = usePermission(SELF_SERVICE_CREATE);
  const canReadAny = usePermission(READ_ANY_SCOPE);
  const canDecide = usePermission(DECIDE_ANY_SCOPE);

  const [requestedTab, setActiveTab] = useState<TabKey>(
    hasSelfServiceRead ? "mine" : "team",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>(
    {},
  );
  const [isSubmittingMap, setIsSubmittingMap] = useState<
    Record<number, boolean>
  >({});

  // Modal dialog states
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<ExpenseClaimItem | null>(
    null,
  );
  const [decision, setDecision] = useState<DecisionState>(null);

  const decideMutation = useDecideExpenseClaim();
  const { toast } = useToast();

  // Load employees for code lookup
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employeeCodeMap = useMemo(() => {
    const map = new Map<number, string>();
    const options = employeesQuery.data?.data ?? [];
    for (const emp of options) {
      map.set(emp.id, emp.employeeCode);
    }
    return map;
  }, [employeesQuery.data?.data]);

  // Overview queries for accurate metric card calculation
  const myOverview = useMyExpenseClaims({ page: 1, limit: 100 });
  const teamOverview = useExpenseClaims({ page: 1, limit: 100 }, canReadAny);

  const notAnEmployee =
    myOverview.isError &&
    myOverview.error instanceof ApiError &&
    myOverview.error.errorCode === "NOT_AN_EMPLOYEE";
  const canReadMine = hasSelfServiceRead && !notAnEmployee;
  const canCreateMine = hasSelfServiceCreate && !notAnEmployee;
  const activeTab: TabKey =
    requestedTab === "mine" && !canReadMine && canReadAny
      ? "team"
      : requestedTab;

  const myClaimsAll = myOverview.data?.data ?? [];
  const teamClaimsAll = teamOverview.data?.data ?? [];

  useEffect(() => {
    if (!urlClaimId) return;
    const cid = parseInt(urlClaimId, 10);
    if (isNaN(cid) || cid <= 0) return;

    const all = [...teamClaimsAll, ...myClaimsAll];
    const claim = all.find((c) => c.id === cid);
    if (claim) {
      const timer = setTimeout(() => {
        if (teamClaimsAll.some((c) => c.id === cid)) {
          setActiveTab("team");
        } else {
          setActiveTab("mine");
        }
        setDetailsTarget(claim);
        setCollapsedCategories((prev) => ({
          ...prev,
          [claim.expenseType]: false,
        }));
        const el = document.getElementById(`expense-card-${cid}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [urlClaimId, teamClaimsAll, myClaimsAll]);

  // 2-Tier Financial Metrics Calculations
  const metrics = useMemo(() => {
    const source = activeTab === "mine" ? myClaimsAll : teamClaimsAll;

    const pendingClaims = source.filter((c) => c.status === "PENDING");
    const approvedClaims = source.filter((c) => c.status === "APPROVED");
    const rejectedClaims = source.filter((c) => c.status === "REJECTED");

    const pendingAmount = pendingClaims.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );
    const approvedAmount = approvedClaims.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );
    const rejectedAmount = rejectedClaims.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );
    const totalAmount = source.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );

    // Category breakdown
    const categoryMap = new Map<
      ExpenseType,
      { count: number; amount: number; pendingCount: number }
    >();
    for (const type of EXPENSE_TYPES) {
      categoryMap.set(type, { count: 0, amount: 0, pendingCount: 0 });
    }
    for (const c of source) {
      const existing = categoryMap.get(c.expenseType) || {
        count: 0,
        amount: 0,
        pendingCount: 0,
      };
      existing.count += 1;
      existing.amount += Number(c.amount || 0);
      if (c.status === "PENDING") {
        existing.pendingCount += 1;
      }
      categoryMap.set(c.expenseType, existing);
    }

    return {
      totalCount: source.length,
      totalAmount,
      pendingCount: pendingClaims.length,
      pendingAmount,
      approvedCount: approvedClaims.length,
      approvedAmount,
      rejectedCount: rejectedClaims.length,
      rejectedAmount,
      categories: categoryMap,
    };
  }, [activeTab, myClaimsAll, teamClaimsAll]);

  // Query for current tab
  const activeQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.expenseType ? { expenseType: filters.expenseType } : {}),
    }),
    [page, filters.status, filters.expenseType],
  );

  const myList = useMyExpenseClaims(activeQuery);
  const teamList = useExpenseClaims(activeQuery, canReadAny);

  const currentList = activeTab === "mine" ? myList : teamList;

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasFilters =
    filters.status !== "" ||
    filters.expenseType !== "" ||
    filters.search !== "";

  // Filtered rows for client search
  const displayedRows: TableClaimItem[] = useMemo(() => {
    const rawItems = currentList.data?.data ?? [];
    let items = rawItems;

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.expenseType.toLowerCase().includes(q) ||
          (r.receiptRef && r.receiptRef.toLowerCase().includes(q)) ||
          (activeTab === "team" &&
            r.employee.fullName.toLowerCase().includes(q)),
      );
    }

    return items.map((r, idx) => ({
      ...r,
      rowNumber: (page - 1) * PAGE_SIZE + idx + 1,
    }));
  }, [currentList.data?.data, filters.search, activeTab, page]);

  const totalRecords = currentList.data?.meta.total ?? displayedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Grouped by Expense Type for Reference 3 View
  const groupedClaims = useMemo(() => {
    const groups: Record<string, TableClaimItem[]> = {};
    for (const claim of displayedRows) {
      const list = groups[claim.expenseType] ?? [];
      list.push(claim);
      groups[claim.expenseType] = list;
    }
    return groups;
  }, [displayedRows]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Interactive Metric Card Filters
  function handleStatusCardClick(status: ExpenseClaimStatus) {
    if (filters.status === status) {
      update("status", "");
    } else {
      update("status", status);
    }
  }

  function handleCategoryCardClick(type: ExpenseType) {
    if (filters.expenseType === type) {
      update("expenseType", "");
    } else {
      update("expenseType", type);
    }
  }

  // Fast Inline Decision (Approve / Reject) with Note
  async function handleInlineDecision(
    claim: ExpenseClaimItem,
    decisionChoice: "APPROVED" | "REJECTED",
  ) {
    const note = (decisionNotes[claim.id] || "").trim();
    setIsSubmittingMap((prev) => ({ ...prev, [claim.id]: true }));
    try {
      await decideMutation.mutateAsync({
        id: claim.id,
        body: {
          decision: decisionChoice,
          ...(note ? { decisionNote: note } : {}),
        },
      });
      toast({
        title:
          decisionChoice === "APPROVED"
            ? "Expense claim approved"
            : "Expense claim rejected",
        variant: "success",
      });
      setDecisionNotes((prev) => {
        const next = { ...prev };
        delete next[claim.id];
        return next;
      });
    } catch (error) {
      toast({
        title:
          decisionChoice === "APPROVED"
            ? "Could not approve claim"
            : "Could not reject claim",
        description: describeDecideError(error),
        variant: "error",
      });
    } finally {
      setIsSubmittingMap((prev) => ({ ...prev, [claim.id]: false }));
    }
  }

  // Export to Excel / CSV
  function handleExport() {
    const claimsToExport = activeTab === "mine" ? myClaimsAll : teamClaimsAll;
    if (claimsToExport.length === 0) {
      toast({ title: "No expense claims to export", variant: "warning" });
      return;
    }
    const headers = [
      "Claim ID",
      "Employee Name",
      "Employee Code",
      "Expense Type",
      "Amount (INR)",
      "Expense Date",
      "Description",
      "Receipt Ref",
      "Status",
      "Decided By",
      "Decided At",
      "Decision Note",
      "Submitted On",
    ];
    const rows = claimsToExport.map((c) => [
      c.id,
      `"${(c.employee?.fullName || "").replace(/"/g, '""')}"`,
      employeeCodeMap.get(c.employee?.id) || "",
      c.expenseType,
      c.amount,
      c.expenseDate,
      `"${(c.description || "").replace(/"/g, '""')}"`,
      c.receiptRef || "",
      c.status,
      `"${(c.decidedBy?.fullName || "").replace(/"/g, '""')}"`,
      c.decidedAt ? formatExpenseDate(c.decidedAt) : "",
      `"${(c.decisionNote || "").replace(/"/g, '""')}"`,
      c.createdAt ? formatExpenseDate(c.createdAt) : "",
    ]);
    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `texaone_expense_claims_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Expense claims exported successfully",
      variant: "success",
    });
  }

  if (!canReadMine && !canReadAny) {
    return (
      <Alert variant="warning" title="You don't have access to expense claims">
        Ask an administrator for the <code>hr.expense_claim.read</code> or{" "}
        <code>employee_self_service.expense_claim.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header Banner with View Modes, Export & Primary Actions */}
      <HrPageHeader
        title="Expense Approvals"
        description="Submit reimbursement claims and review organizational expenses you are authorized to access."
        icon={Receipt}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Segmented Controls */}
            <div className="flex items-center gap-1 rounded-xl bg-white/20 p-1 border border-white/30 backdrop-blur-xs">
              <button
                type="button"
                title="Category Cards View"
                aria-label="Category Cards View"
                onClick={() => setViewMode("grouped")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "grouped"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Category View</span>
              </button>
              <button
                type="button"
                title="Table View"
                aria-label="Table View"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-white text-brand-600 shadow-xs"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* Export Excel Button */}
            <Button
              variant="secondary"
              onClick={handleExport}
              className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-3.5 py-2 font-medium text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel</span>
            </Button>

            {/* Submit Expense Claim button */}
            {canCreateMine ? (
              <Button
                onClick={() => setSubmitOpen(true)}
                className="gap-1.5 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                <span>Submit Expense Claim</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* 2. Tier 1: Primary Status & Rupee Financial Metrics (Reference 3 Inspiration) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Pending Card */}
        <button
          type="button"
          onClick={() => handleStatusCardClick("PENDING")}
          className={`flex items-center justify-between rounded-2xl border p-4.5 text-left transition-all ${
            filters.status === "PENDING"
              ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-500/20 dark:bg-amber-950/40 dark:border-amber-600"
              : "border-gray-200/90 bg-white hover:border-amber-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Pending
              </p>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
                {metrics.pendingCount}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-theme-xs text-gray-400">Amount</span>
            <p className="text-base font-bold text-amber-700 dark:text-amber-300">
              {formatIndianCurrency(metrics.pendingAmount)}
            </p>
          </div>
        </button>

        {/* Approved Card */}
        <button
          type="button"
          onClick={() => handleStatusCardClick("APPROVED")}
          className={`flex items-center justify-between rounded-2xl border p-4.5 text-left transition-all ${
            filters.status === "APPROVED"
              ? "border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:border-emerald-600"
              : "border-gray-200/90 bg-white hover:border-emerald-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Approved
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {metrics.approvedCount}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-theme-xs text-gray-400">Amount</span>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatIndianCurrency(metrics.approvedAmount)}
            </p>
          </div>
        </button>

        {/* Rejected Card */}
        <button
          type="button"
          onClick={() => handleStatusCardClick("REJECTED")}
          className={`flex items-center justify-between rounded-2xl border p-4.5 text-left transition-all ${
            filters.status === "REJECTED"
              ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-500/20 dark:bg-rose-950/40 dark:border-rose-600"
              : "border-gray-200/90 bg-white hover:border-rose-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-dark"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Ban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                Rejected
              </p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {metrics.rejectedCount}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-theme-xs text-gray-400">
              Total {metrics.totalCount} claims
            </span>
            <p className="text-base font-bold text-rose-600 dark:text-rose-400">
              {formatIndianCurrency(metrics.rejectedAmount)}
            </p>
          </div>
        </button>
      </div>

      {/* 3. Tier 2: Category Spend Breakdown Cards (Reference 3 Inspiration) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {EXPENSE_TYPES.map((type) => {
          const cat = metrics.categories.get(type) || {
            count: 0,
            amount: 0,
            pendingCount: 0,
          };
          const Icon = getExpenseTypeIcon(type);
          const isSelected = filters.expenseType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleCategoryCardClick(type)}
              className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                isSelected
                  ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-600"
                  : "border-gray-200/80 bg-white hover:border-brand-300 hover:shadow-2xs dark:border-gray-800 dark:bg-gray-dark"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-theme-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                  {type}
                </span>
                <Icon className="h-4 w-4 text-brand-500 shrink-0" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {formatIndianCurrency(cat.amount)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  <span>{cat.count} claims</span>
                  {cat.pendingCount > 0 ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {cat.pendingCount} pending
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Tab Navigation & Filter Toolbar Container */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-dark flex flex-col gap-4">
        {/* Tab Pills */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-850">
          <div className="flex items-center gap-2">
            {canReadMine ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("mine");
                  setPage(1);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === "mine"
                    ? "bg-brand-50 text-brand-600 shadow-xs dark:bg-brand-950/60 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                My Expense Claims ({myClaimsAll.length})
              </button>
            ) : null}

            {canReadAny ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("team");
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === "team"
                    ? "bg-brand-50 text-brand-600 shadow-xs dark:bg-brand-950/60 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Team / Organization Claims
                {teamClaimsAll.filter((c) => c.status === "PENDING").length >
                0 ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {teamClaimsAll.filter((c) => c.status === "PENDING").length}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>

          <div className="text-theme-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Showing{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {displayedRows.length}
            </span>{" "}
            claims
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={
                activeTab === "mine"
                  ? "Search by description, type, or receipt ref..."
                  : "Search employee, description, or receipt ref..."
              }
              aria-label="Search expense claims"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              className="pl-9.5"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                update("status", e.target.value as "" | ExpenseClaimStatus)
              }
            >
              <option value="">All statuses</option>
              {EXPENSE_CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          {/* Expense Type Filter */}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by expense type"
              value={filters.expenseType}
              onChange={(e) =>
                update("expenseType", e.target.value as "" | ExpenseType)
              }
            >
              <option value="">All expense types</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          {/* Reset Button */}
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {/* 5. Main Content Area */}
      {currentList.isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={7} />
      ) : currentList.isError ? (
        <ErrorState onRetry={() => void currentList.refetch()} />
      ) : displayedRows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <EmptyState
            title={
              hasFilters
                ? "No expense claims match these filters"
                : activeTab === "mine"
                  ? "No expense claims yet"
                  : "No team claims to review"
            }
            description={
              hasFilters
                ? "Try adjusting your search terms or reset the filters."
                : activeTab === "mine"
                  ? "Submit a reimbursement claim for travel, meals, or other business expenses."
                  : "Expense claims submitted by your team will appear here for review."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </Button>
              ) : activeTab === "mine" && canCreateMine ? (
                <Button size="sm" onClick={() => setSubmitOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Submit Expense Claim
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* A. CATEGORY ACCORDION VIEW (Reference 3 Inspiration) */}
          {viewMode === "grouped" && (
            <div className="flex flex-col gap-4">
              {Object.entries(groupedClaims).map(([category, claims]) => {
                const Icon = getExpenseTypeIcon(category as ExpenseType);
                const isCollapsed = Boolean(collapsedCategories[category]);
                const categoryTotal = claims.reduce(
                  (sum, c) => sum + Number(c.amount || 0),
                  0,
                );
                const pendingCount = claims.filter(
                  (c) => c.status === "PENDING",
                ).length;

                return (
                  <div
                    key={category}
                    className="flex flex-col rounded-2xl border border-gray-200/90 bg-white shadow-xs overflow-hidden dark:border-gray-800 dark:bg-gray-dark transition-all"
                  >
                    {/* Collapsible Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(category)}
                      className="flex items-center justify-between px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100/80 dark:bg-gray-850 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-brand-600 dark:bg-gray-900 dark:border-gray-700 dark:text-brand-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          {category}
                        </span>
                        <span className="rounded-full bg-gray-200/70 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {claims.length}{" "}
                          {claims.length === 1 ? "claim" : "claims"}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {pendingCount} pending
                          </span>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                          {formatIndianCurrency(categoryTotal)}
                        </span>
                      </div>
                    </button>

                    {/* Claims Cards Inside Category */}
                    {!isCollapsed && (
                      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 p-2 sm:p-3">
                        {claims.map((claim) => {
                          const isPending = claim.status === "PENDING";
                          const isSubmitting = Boolean(
                            isSubmittingMap[claim.id],
                          );

                          const isSelected = detailsTarget?.id === claim.id;

                          return (
                            <div
                              key={claim.id}
                              id={`expense-card-${claim.id}`}
                              className={`flex flex-col gap-3.5 p-4 rounded-xl transition-all ${
                                isSelected
                                  ? "bg-brand-50/30 border-2 border-brand-500 ring-2 ring-brand-500/20 shadow-md dark:bg-brand-950/20"
                                  : "hover:bg-gray-50/60 dark:hover:bg-gray-850/50"
                              }`}
                            >
                              {/* Top Row: Amount, Status & Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                                    {formatIndianCurrency(claim.amount)}
                                  </span>
                                  {isSelected && (
                                    <span className="rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-cyan-300 text-[10px] font-bold px-2 py-0.5 border border-brand-300/60 dark:border-brand-700">
                                      Selected
                                    </span>
                                  )}
                                  <ExpenseClaimStatusBadge
                                    status={claim.status}
                                  />
                                  {claim.receiptRef ? (
                                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
                                      Receipt #{claim.receiptRef}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label="View details"
                                    onClick={() => setDetailsTarget(claim)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Employee & Description Info */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex flex-col gap-1.5">
                                  {activeTab === "team" ? (
                                    <EmployeeIdentity
                                      name={claim.employee.fullName}
                                      code={employeeCodeMap.get(
                                        claim.employee.id,
                                      )}
                                      size="sm"
                                    />
                                  ) : null}
                                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 text-theme-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 max-w-2xl leading-relaxed">
                                    {claim.description}
                                  </div>
                                </div>

                                {/* Metadata */}
                                <div className="flex flex-col text-theme-xs text-gray-500 dark:text-gray-400 gap-1 text-left sm:text-right shrink-0">
                                  <div className="flex items-center gap-1.5 sm:justify-end">
                                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                    <span>
                                      Date:{" "}
                                      {formatExpenseDate(claim.expenseDate)}
                                    </span>
                                  </div>
                                  <div>
                                    Submitted:{" "}
                                    {formatExpenseDate(claim.createdAt)}
                                  </div>
                                  {claim.decidedBy && claim.decidedAt ? (
                                    <div className="text-[11px] text-gray-400">
                                      Decided by {claim.decidedBy.fullName} on{" "}
                                      {formatExpenseDate(claim.decidedAt)}
                                      {claim.decisionNote ? (
                                        <span className="italic block mt-0.5">
                                          &ldquo;{claim.decisionNote}&rdquo;
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {/* Inline Decision Bar for Approvers (Reference 3 Feature) */}
                              {activeTab === "team" &&
                              canDecide &&
                              isPending ? (
                                <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      placeholder="Add a decision note (optional)..."
                                      value={decisionNotes[claim.id] || ""}
                                      onChange={(e) =>
                                        setDecisionNotes((prev) => ({
                                          ...prev,
                                          [claim.id]: e.target.value,
                                        }))
                                      }
                                      disabled={isSubmitting}
                                      className="w-full text-xs rounded-xl border border-gray-200 px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() =>
                                        void handleInlineDecision(
                                          claim,
                                          "APPROVED",
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-colors"
                                    >
                                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() =>
                                        void handleInlineDecision(
                                          claim,
                                          "REJECTED",
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-colors"
                                    >
                                      <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                      <span>Reject</span>
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* B. TABLE VIEW (Dense Tabular View) */}
          {viewMode === "table" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-dark">
              <DataTable
                caption="Expense Claims"
                rows={displayedRows}
                getRowKey={(c) => String(c.id)}
                columns={[
                  {
                    header: "#",
                    cell: (c) => (
                      <span className="text-theme-xs text-gray-500 font-medium">
                        {c.rowNumber}
                      </span>
                    ),
                  },
                  ...(activeTab === "team"
                    ? [
                        {
                          header: "Employee",
                          cell: (c: TableClaimItem) => (
                            <EmployeeIdentity
                              name={c.employee.fullName}
                              code={employeeCodeMap.get(c.employee.id)}
                              size="sm"
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    header: "Date",
                    cell: (c) => (
                      <span className="text-theme-sm text-gray-800 dark:text-gray-200">
                        {formatExpenseDate(c.expenseDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Expense Type",
                    cell: (c) => (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
                          {c.expenseType}
                        </span>
                        {detailsTarget?.id === c.id && (
                          <span className="rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-cyan-300 text-[9px] font-bold px-1.5 py-0.2 border border-brand-300/60 dark:border-brand-700">
                            Selected
                          </span>
                        )}
                        {c.receiptRef ? (
                          <span className="text-[11px] text-gray-400">
                            (#{c.receiptRef})
                          </span>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    header: "Description",
                    cell: (c) => (
                      <span className="text-theme-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-xs">
                        {c.description}
                      </span>
                    ),
                  },
                  {
                    header: "Amount",
                    cell: (c) => (
                      <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
                        {formatIndianCurrency(c.amount)}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    cell: (c) => <ExpenseClaimStatusBadge status={c.status} />,
                  },
                  {
                    header: "Actions",
                    cell: (c) => (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`View claim details`}
                          onClick={() => setDetailsTarget(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {activeTab === "team" &&
                        canDecide &&
                        c.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              aria-label="Approve claim"
                              onClick={() =>
                                setDecision({ claim: c, decision: "APPROVED" })
                              }
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Reject claim"
                              onClick={() =>
                                setDecision({ claim: c, decision: "REJECTED" })
                              }
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-1 py-3 dark:border-gray-800">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords}{" "}
              records
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* 6. Centered Modals */}
      {submitOpen ? (
        <SubmitExpenseClaimDialog
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
        />
      ) : null}

      <ExpenseClaimDetailsDialog
        open={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        claim={detailsTarget}
      />

      {decision ? (
        <DecideExpenseClaimDialog
          open={Boolean(decision)}
          onClose={() => setDecision(null)}
          claim={decision.claim}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}
