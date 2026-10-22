"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  Plus,
  Receipt,
  Search,
  X,
} from "lucide-react";
import {
  useCreateExpense,
  useExpenses,
  useProjects,
  useUpdateExpense,
} from "@/features/projects/hooks";
import type { ProjectExpense } from "@/features/projects/types";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: projectsData } = useProjects({ limit: 100 });
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalProjectId, setModalProjectId] = useState<number>(0);
  const [modalVendor, setModalVendor] = useState("");
  const [modalReference, setModalReference] = useState("");
  const [modalAmount, setModalAmount] = useState<number>(500);
  const [modalDate, setModalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [modalStatus, setModalStatus] = useState<"paid" | "unpaid">("unpaid");
  const [modalNotes, setModalNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const projects = projectsData?.data || [];

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((exp) => {
      const matchSearch =
        (exp.vendor || "").toLowerCase().includes(search.toLowerCase()) ||
        (exp.referenceNo || "").toLowerCase().includes(search.toLowerCase()) ||
        (exp.project?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (exp.notes || "").toLowerCase().includes(search.toLowerCase());

      const matchProject =
        projectFilter === "all" || String(exp.projectId) === projectFilter;

      const matchStatus = statusFilter === "all" || exp.status === statusFilter;

      return matchSearch && matchProject && matchStatus;
    });
  }, [expenses, search, projectFilter, statusFilter]);

  const summary = useMemo(() => {
    if (!expenses) return { total: 0, paid: 0, unpaid: 0, count: 0 };
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      total += amt;
      if (exp.status === "paid") {
        paid += amt;
      } else {
        unpaid += amt;
      }
    }
    return { total, paid, unpaid, count: expenses.length };
  }, [expenses]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const selectedPid =
      Number(modalProjectId) || (projects.length > 0 ? projects[0]?.id : 0);
    if (!selectedPid) {
      setFormError("Please select a valid project.");
      return;
    }
    if (!modalVendor.trim()) {
      setFormError("Vendor name is required.");
      return;
    }

    try {
      await createExpenseMutation.mutateAsync({
        projectId: selectedPid,
        input: {
          vendor: modalVendor,
          reference: modalReference || undefined,
          amount: Number(modalAmount) || 0,
          date: modalDate,
          status: modalStatus,
          notes: modalNotes || undefined,
        },
      });

      setShowCreateModal(false);
      setModalVendor("");
      setModalReference("");
      setModalAmount(500);
      setModalNotes("");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to record expense",
      );
    }
  };

  const handleToggleStatus = async (exp: ProjectExpense) => {
    const nextStatus = exp.status === "paid" ? "unpaid" : "paid";
    try {
      await updateExpenseMutation.mutateAsync({
        expenseId: exp.id,
        input: { status: nextStatus },
      });
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to update expense status",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Project Expenses & Invoicing
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Log vendor expenditures, track prototype costs, and monitor contract
            budget depletion.
          </p>
        </div>

        <button
          onClick={() => {
            if (projects.length > 0 && projects[0] && !modalProjectId) {
              setModalProjectId(projects[0].id);
            }
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Record Expense
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Recorded Spend
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {formatCurrency(summary.total)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Across {summary.count} logged vouchers
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Settled / Paid
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.paid)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Vendor payments cleared
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Outstanding / Unpaid
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.unpaid)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Pending treasury disbursement
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Projects
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {projects.length}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Available project accounts
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, reference invoice, notes..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-4 text-xs text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="py-3 pl-4 pr-3 font-bold">Date</th>
                <th className="px-3 py-3 font-bold">Reference / Bill</th>
                <th className="px-3 py-3 font-bold">Project</th>
                <th className="px-3 py-3 font-bold">Vendor</th>
                <th className="px-3 py-3 font-bold">Department</th>
                <th className="px-3 py-3 font-bold">Amount</th>
                <th className="px-3 py-3 font-bold">Payment Status</th>
                <th className="px-3 py-3 font-bold">Notes</th>
                <th className="py-3 pl-3 pr-4 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-cyan-400" />
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    No expense vouchers matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                  >
                    <td className="whitespace-nowrap py-3 pl-4 pr-3 font-mono text-gray-600 dark:text-gray-400">
                      {exp.expenseDate?.slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 font-mono font-semibold text-gray-900 dark:text-white">
                      {exp.referenceNo || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/projects/${exp.projectId}`}
                        className="font-medium text-blue-600 hover:underline dark:text-cyan-400"
                      >
                        {exp.project?.name || `Project #${exp.projectId}`}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">
                      {exp.vendor}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {exp.department || "General"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(Number(exp.amount) || 0)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleToggleStatus(exp)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-transform active:scale-95 ${
                          exp.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                        title="Click to toggle status"
                      >
                        {exp.status === "paid" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {exp.status}
                      </button>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-gray-500 dark:text-gray-400">
                      {exp.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(exp)}
                        className="text-xs font-semibold text-blue-600 hover:underline dark:text-cyan-400"
                      >
                        Mark as {exp.status === "paid" ? "Unpaid" : "Paid"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Record Project Expense
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Target Project <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={modalProjectId}
                  onChange={(e) => setModalProjectId(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Vendor / Merchant <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mouser Electronics"
                    value={modalVendor}
                    onChange={(e) => setModalVendor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Invoice / Receipt Ref
                  </label>
                  <input
                    type="text"
                    placeholder="INV-9921"
                    value={modalReference}
                    onChange={(e) => setModalReference(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Amount ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={modalAmount}
                    onChange={(e) => setModalAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Payment Status
                </label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="status"
                      checked={modalStatus === "unpaid"}
                      onChange={() => setModalStatus("unpaid")}
                    />
                    Unpaid
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="status"
                      checked={modalStatus === "paid"}
                      onChange={() => setModalStatus("paid")}
                    />
                    Paid
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Purchased test boards and sensors..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                >
                  {createExpenseMutation.isPending
                    ? "Recording..."
                    : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
