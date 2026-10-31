"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit2,
  Filter,
  IndianRupee,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  SearchInput,
  Select,
  TableSkeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useExpenseVendors,
  useProjects,
  useUpdateExpense,
} from "@/features/projects/hooks";
import {
  errorMessage,
  formatCurrency,
  formatDate,
  toDateInput,
  todayInput,
} from "@/features/projects/format";
import type { ExpenseStatus, ProjectExpense } from "@/features/projects/types";

type SortField = "expenseDate" | "amount";
type SortDirection = "asc" | "desc";

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
  unpaid:
    "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300",
  cancelled:
    "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  cancelled: "Cancelled",
};

interface ExpenseForm {
  projectId: number;
  department: string;
  vendor: string;
  referenceNo: string;
  amount: string;
  expenseDate: string;
  status: ExpenseStatus;
  notes: string;
}

function emptyForm(projectId: number): ExpenseForm {
  return {
    projectId,
    department: "",
    vendor: "",
    referenceNo: "",
    amount: "",
    expenseDate: todayInput(),
    status: "paid",
    notes: "",
  };
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const expensesQuery = useExpenses();
  const { data: projectsData } = useProjects({ limit: 100 });
  const vendorsQuery = useExpenseVendors();
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  const expenses = expensesQuery.data;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("expenseDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Create/Edit dialog state
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(
    null,
  );
  const [form, setForm] = useState<ExpenseForm>(() => emptyForm(0));
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectExpense | null>(null);

  const projects = useMemo(() => projectsData?.data ?? [], [projectsData]);

  // Legacy showed a "Client Name" column per expense — the expense row only
  // embeds {id, projectCode, name}, so the client comes from the project.
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const clientOfProject = (projectId: number): string => {
    const p = projectById.get(projectId);
    return p?.customerName || p?.customer?.name || "";
  };
  const clientOf = (exp: ProjectExpense): string =>
    clientOfProject(exp.projectId);

  const vendors = useMemo(
    () =>
      Array.from(
        new Set((expenses ?? []).map((e) => e.vendor).filter(Boolean)),
      ).sort() as string[],
    [expenses],
  );
  // Vendor picker options: the SCM supplier master first, then free-text
  // vendors already used on expenses that aren't in the master.
  const supplierByName = useMemo(
    () =>
      new Map(
        (vendorsQuery.data ?? []).map((s) => [s.companyName.toLowerCase(), s]),
      ),
    [vendorsQuery.data],
  );
  const vendorOptions = useMemo(
    () => [
      ...(vendorsQuery.data ?? []).map((s) => ({
        value: s.companyName,
        label: `${s.supplierCode} · supplier master`,
      })),
      ...vendors
        .filter((v) => !supplierByName.has(v.toLowerCase()))
        .map((v) => ({ value: v, label: "previously used" })),
    ],
    [vendorsQuery.data, vendors, supplierByName],
  );
  const matchedSupplier = supplierByName.get(form.vendor.trim().toLowerCase());
  const departments = useMemo(
    () =>
      Array.from(
        new Set([
          ...(expenses ?? []).map((e) => e.department),
          ...projects.flatMap((p) => p.departments ?? []),
        ]),
      )
        .filter(Boolean)
        .sort() as string[],
    [expenses, projects],
  );

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    vendorFilter !== "all" ||
    departmentFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setVendorFilter("all");
    setDepartmentFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  // `GET /projects/expenses` takes no query params — all filtering is
  // client-side, matching legacy `ProjectExpenses.tsx`.
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    const q = search.trim().toLowerCase();
    const filtered = expenses.filter((exp) => {
      if (q) {
        const p = projectById.get(exp.projectId);
        const haystack = [
          exp.vendor,
          exp.referenceNo,
          exp.project?.name,
          exp.project?.projectCode,
          exp.notes,
          exp.department,
          p?.customerName,
          p?.customer?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "all" && exp.status !== statusFilter) return false;
      if (vendorFilter !== "all" && exp.vendor !== vendorFilter) return false;
      if (departmentFilter !== "all" && exp.department !== departmentFilter)
        return false;
      const expDate = toDateInput(exp.expenseDate);
      if (dateFrom && expDate < dateFrom) return false;
      if (dateTo && expDate > dateTo) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const cmp =
        sortField === "amount"
          ? (Number(a.amount) || 0) - (Number(b.amount) || 0)
          : toDateInput(a.expenseDate).localeCompare(
              toDateInput(b.expenseDate),
            );
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [
    expenses,
    projectById,
    search,
    statusFilter,
    vendorFilter,
    departmentFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const summary = useMemo(() => {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    for (const exp of expenses ?? []) {
      const amt = Number(exp.amount) || 0;
      if (exp.status === "cancelled") continue;
      total += amt;
      if (exp.status === "paid") paid += amt;
      else unpaid += amt;
    }
    return { total, paid, unpaid, count: expenses?.length ?? 0 };
  }, [expenses]);

  function openCreateModal(projectId?: number) {
    setEditingExpense(null);
    setFormError(null);
    const pid = projectId ?? projects[0]?.id ?? 0;
    const next = emptyForm(pid);
    next.department = projectById.get(pid)?.departments?.[0] ?? "";
    setForm(next);
    setShowModal(true);
  }

  function openEditModal(exp: ProjectExpense) {
    setEditingExpense(exp);
    setFormError(null);
    setForm({
      projectId: exp.projectId,
      department: exp.department ?? "",
      vendor: exp.vendor ?? "",
      referenceNo: exp.referenceNo ?? "",
      amount: String(Number(exp.amount) || ""),
      expenseDate: toDateInput(exp.expenseDate) || todayInput(),
      status: exp.status,
      notes: exp.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingExpense(null);
  }

  function setField<K extends keyof ExpenseForm>(
    key: K,
    value: ExpenseForm[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = parseFloat(form.amount);
    if (!editingExpense && !form.projectId) {
      setFormError("Please select a project.");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setFormError("Please enter a valid amount greater than ₹0.");
      return;
    }
    if (!form.vendor.trim()) {
      setFormError("Please select or specify a vendor.");
      return;
    }
    if (!form.expenseDate) {
      setFormError("Expense date is required.");
      return;
    }

    const supplier = supplierByName.get(form.vendor.trim().toLowerCase());
    const input = {
      amount,
      expenseDate: form.expenseDate,
      vendor: form.vendor.trim(),
      // Linked to the SCM supplier master when the name matches a supplier;
      // otherwise kept as a free-text vendor.
      ...(supplier ? { supplierId: supplier.id } : {}),
      referenceNo: form.referenceNo.trim() || undefined,
      department: form.department.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editingExpense) {
        await updateExpenseMutation.mutateAsync({
          expenseId: editingExpense.id,
          input,
        });
        toast({ title: "Project expense updated", variant: "success" });
      } else {
        await createExpenseMutation.mutateAsync({
          projectId: form.projectId,
          input,
        });
        toast({ title: "Project expense recorded", variant: "success" });
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(
        errorMessage(
          err,
          `Failed to ${editingExpense ? "update" : "record"} expense`,
        ),
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Expense record deleted", variant: "success" });
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to delete expense"),
        variant: "error",
      });
    }
  };

  const handleToggleStatus = async (exp: ProjectExpense) => {
    const nextStatus: ExpenseStatus = exp.status === "paid" ? "unpaid" : "paid";
    try {
      await updateExpenseMutation.mutateAsync({
        expenseId: exp.id,
        input: { status: nextStatus },
      });
      toast({
        title: `Marked as ${STATUS_LABELS[nextStatus]}`,
        variant: "success",
      });
    } catch (err: unknown) {
      toast({
        title: errorMessage(err, "Failed to update expense status"),
        variant: "error",
      });
    }
  };

  const saving =
    createExpenseMutation.isPending || updateExpenseMutation.isPending;

  const sortIcon = (field: SortField) =>
    sortField === field ? (
      sortDirection === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    );

  const selectClass =
    "rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

  return (
    <div className="flex flex-col gap-6">
      {/* Header banner — legacy "Project Expenses" hero */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-sky-200/60 bg-gradient-to-r from-[#0a3271] via-[#1769F5] to-[#12CFE3] p-6 text-white shadow-lg shadow-blue-500/10 dark:border-sky-900/40">
        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="rounded-2xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-md">
              <Receipt className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Project Expenses
            </h1>
          </div>
          <p className="pl-1 text-xs text-cyan-50/90 sm:text-sm">
            Track and manage all project-related expenditures, vendor invoices
            &amp; department allocations
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateModal()}
          disabled={projects.length === 0}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-brand-700 shadow-md transition-colors hover:bg-sky-50 disabled:opacity-60 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Expenses
            </span>
            <div className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {formatCurrency(summary.total)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Across {summary.count} logged vouchers (excl. cancelled)
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Paid Amount
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.paid)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Vendor payments cleared
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Unpaid Amount
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.unpaid)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Pending treasury disbursement
          </p>
        </div>
      </div>

      {/* Filter & Search card */}
      <div className="relative focus-within:z-30 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3 text-xs font-bold text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
          <Filter className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
          Filter &amp; Search Expenses
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[240px] flex-1">
              <SearchInput
                value={search}
                onChangeValue={setSearch}
                onClear={() => setSearch("")}
                clearable
                sizeVariant="sm"
                placeholder="Search project, client, vendor, reference, notes..."
                aria-label="Search expenses"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <select
              aria-label="Filter by vendor"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All Vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <label
                htmlFor="expense-date-from"
                className="text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
              >
                Date From:
              </label>
              <div className="w-44">
                <Input
                  id="expense-date-from"
                  aria-label="Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="expense-date-to"
                className="text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
              >
                Date To:
              </label>
              <div className="w-44">
                <Input
                  id="expense-date-to"
                  aria-label="Date To"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Project Expense Records ({filteredExpenses.length})
          </h2>
        </div>
        {expensesQuery.isPending ? (
          <TableSkeleton rowsCount={6} columnsCount={10} className="p-4" />
        ) : expensesQuery.isError ? (
          <ErrorState
            title="Could not load project expenses"
            onRetry={() => expensesQuery.refetch()}
          />
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            title="No project expenses found"
            description={
              hasActiveFilters
                ? "Try clearing your filters."
                : 'Click "Add Expense" to record a new project expense.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-3 font-bold">Client</th>
                  <th className="px-3 py-3 font-bold">Project</th>
                  <th className="px-3 py-3 font-bold">Department</th>
                  <th className="px-3 py-3 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                    >
                      Amount {sortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-3 py-3 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("expenseDate")}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                    >
                      Date {sortIcon("expenseDate")}
                    </button>
                  </th>
                  <th className="px-3 py-3 font-bold">Vendor</th>
                  <th className="px-3 py-3 font-bold">Reference</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Notes</th>
                  <th className="py-3 pl-3 pr-4 text-right font-bold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-sky-50/40 dark:hover:bg-gray-800/40"
                  >
                    <td className="py-3 pl-4 pr-3 font-bold text-gray-900 dark:text-white">
                      {clientOf(exp) || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/projects/${exp.projectId}`}
                        className="font-semibold text-brand-600 hover:underline dark:text-cyan-400"
                      >
                        {exp.project?.name || `Project #${exp.projectId}`}
                      </Link>
                      {exp.project?.projectCode ? (
                        <span className="block text-[10px] text-gray-400">
                          {exp.project.projectCode}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {exp.department || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-extrabold text-gray-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      {formatDate(exp.expenseDate)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-200">
                      {exp.vendor || "—"}
                      {exp.supplier ? (
                        <span className="block text-[10px] font-medium text-sky-700 dark:text-sky-300">
                          {exp.supplier.supplierCode} · supplier master
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {exp.referenceNo || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(exp)}
                        disabled={exp.status === "cancelled"}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${STATUS_STYLES[exp.status]}`}
                        title={
                          exp.status === "cancelled"
                            ? "Cancelled"
                            : "Click to toggle Paid / Unpaid"
                        }
                      >
                        {exp.status === "paid" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {STATUS_LABELS[exp.status]}
                      </button>
                    </td>
                    <td
                      className="max-w-[160px] truncate px-3 py-3 text-gray-500 dark:text-gray-400"
                      title={exp.notes ?? undefined}
                    >
                      {exp.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          title="Edit Expense"
                          aria-label="Edit expense"
                          className="rounded-lg border border-gray-200 p-1.5 text-amber-600 transition-colors hover:bg-amber-50 dark:border-gray-700 dark:hover:bg-amber-950/30"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exp)}
                          title="Delete Expense"
                          aria-label="Delete expense"
                          className="rounded-lg border border-gray-200 p-1.5 text-rose-500 transition-colors hover:bg-rose-50 dark:border-gray-700 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense dialog */}
      <Dialog
        open={showModal}
        onClose={closeModal}
        size="xl"
        title={
          <span className="flex items-center gap-3">
            <span className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
              <Receipt className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold text-gray-900 dark:text-white">
                {editingExpense ? "Edit Project Expense" : "Record New Expense"}
              </span>
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Log client projects, vendor invoices, and department
                expenditures
              </span>
            </span>
          </span>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
            >
              {formError}
            </p>
          ) : null}

          {/* Project information */}
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-800">
            <h3 className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2.5 text-sm font-bold text-gray-800 dark:border-gray-800 dark:text-gray-200">
              <Briefcase className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Project Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField
                  label="Target Project"
                  required
                  hint={
                    editingExpense
                      ? "An expense cannot be moved to another project."
                      : clientOfProject(form.projectId)
                        ? `Client: ${clientOfProject(form.projectId)}`
                        : undefined
                  }
                >
                  {(field) => (
                    <Select
                      {...field}
                      value={String(form.projectId || "")}
                      disabled={Boolean(editingExpense)}
                      onChange={(e) => {
                        const pid = Number(e.target.value);
                        setForm((f) => ({
                          ...f,
                          projectId: pid,
                          department:
                            f.department ||
                            projectById.get(pid)?.departments?.[0] ||
                            "",
                        }));
                      }}
                    >
                      {editingExpense &&
                      !projectById.has(editingExpense.projectId) ? (
                        <option value={String(editingExpense.projectId)}>
                          {editingExpense.project?.projectCode} —{" "}
                          {editingExpense.project?.name}
                        </option>
                      ) : null}
                      {projects.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.projectCode} — {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                {!editingExpense && projects.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {projects.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            projectId: p.id,
                            department: p.departments?.[0] ?? f.department,
                          }))
                        }
                        className="rounded-md border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-700 transition-colors hover:bg-sky-50 dark:border-sky-900/50 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <FormField label="Department">
                {(field) => (
                  <Input
                    {...field}
                    list="expense-department-options"
                    value={form.department}
                    onChange={(e) => setField("department", e.target.value)}
                    placeholder="e.g. Engineering"
                  />
                )}
              </FormField>
              <datalist id="expense-department-options">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>

              <FormField label="Date" required>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setField("expenseDate", e.target.value)}
                  />
                )}
              </FormField>
            </div>
          </div>

          {/* Financials & vendor */}
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-800">
            <h3 className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2.5 text-sm font-bold text-gray-800 dark:border-gray-800 dark:text-gray-200">
              <IndianRupee className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Financials &amp; Vendor
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Amount (₹)" required>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Payment Status" required>
                {(field) => (
                  <Select
                    {...field}
                    value={form.status}
                    onChange={(e) =>
                      setField("status", e.target.value as ExpenseStatus)
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </Select>
                )}
              </FormField>
              <FormField
                label="Vendor"
                required
                hint={
                  matchedSupplier
                    ? `Linked to supplier ${matchedSupplier.supplierCode} in the SCM supplier master.`
                    : "Pick a supplier from the SCM supplier master, or type a one-off vendor name."
                }
              >
                {(field) => (
                  <Input
                    {...field}
                    list="expense-vendor-options"
                    value={form.vendor}
                    onChange={(e) => setField("vendor", e.target.value)}
                    placeholder="e.g. Mouser Electronics"
                  />
                )}
              </FormField>
              <datalist id="expense-vendor-options">
                {vendorOptions.map((v) => (
                  <option key={v.value} value={v.value} label={v.label} />
                ))}
              </datalist>
              <FormField label="Reference (PO / Invoice #)">
                {(field) => (
                  <Input
                    {...field}
                    value={form.referenceNo}
                    onChange={(e) =>
                      setField("referenceNo", e.target.value.toUpperCase())
                    }
                    placeholder="e.g. INV-9902"
                  />
                )}
              </FormField>
            </div>
          </div>

          <FormField label="Notes / Remarks">
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Additional context, description or remarks about this expense..."
              />
            )}
          </FormField>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingExpense ? "Update Expense" : "Save Expense"}
            </Button>
          </div>
        </form>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteExpenseMutation.isPending}
        title="Delete expense record"
        itemName={
          deleteTarget
            ? `${deleteTarget.vendor ?? "Expense"} — ${formatCurrency(deleteTarget.amount)}`
            : ""
        }
        description="Deleting an expense also reverses it from the project's actual cost. This cannot be undone."
      />
    </div>
  );
}
