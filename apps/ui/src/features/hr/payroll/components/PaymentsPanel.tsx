"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { exportPaymentBatch } from "../api";
import { downloadText } from "../download";
import { describeError, isoDate, money, periodLabel } from "../format";
import {
  useCreatePaymentBatch,
  usePaymentBatch,
  usePaymentBatches,
  usePeriods,
  useProcessPaymentBatch,
  useUpdatePayment,
} from "../hooks";
import {
  PAYMENT_BATCH_READ,
  PAYMENT_BATCH_WRITE,
  PAYMENT_WRITE,
} from "../permissions";
import {
  BATCH_STATUSES,
  type BatchStatus,
  PAYMENT_METHODS,
  PAYMENT_TRANSITIONS,
  type PaymentBatch,
  type PaymentMethod,
  type PaymentStatus,
  type PayrollPayment,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import {
  exportBatchPaymentsCsv,
  exportBatchPaymentsExcel,
  exportPaymentBatchesCsv,
  exportPaymentBatchesExcel,
} from "./payment-export";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 15;

const METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
};

// ============================================================================
// 1. Create New Batch Dialog
// ============================================================================

/** One batch pays a finalized period's approved run. Bank transfer needs
 * every employee's bank details; the API names anyone missing them. */
function NewBatchDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const create = useCreatePaymentBatch();
  const periods = usePeriods({ page: 1, limit: 100 });
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const finalized = useMemo(
    () => (periods.data?.data ?? []).filter((p) => p.status === "FINALIZED"),
    [periods.data?.data],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId) {
      setError("Please select a finalized payroll period");
      return;
    }
    setError(undefined);
    setServerError(null);

    try {
      const batch = await create.mutateAsync({
        payrollPeriodId: periodId,
        paymentMethod: method,
      });
      toast({
        title: `Payment batch ${batch.batchNumber} created`,
        description: `Batch with ${batch.totalEmployees} employees generated successfully.`,
        variant: "success",
      });
      onCreated(batch.id);
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Create Payment Batch" size="lg">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-1"
        noValidate
      >
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 text-xs text-sky-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-sky-200">
          <p className="font-semibold text-brand-600 dark:text-sky-300">
            Disbursement Requirements
          </p>
          <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
            Payment batches compile net salaries from finalized payroll periods.
            If selecting Bank Transfer, all covered employees must have verified
            bank accounts configured in HR profiles.
          </p>
        </div>

        <FormField
          label="Payroll Period"
          required
          error={error}
          hint="Only periods with finalized payroll runs can be disbursed. Exactly one batch per period."
        >
          {(f) => (
            <Select
              {...f}
              disabled={periods.isPending}
              value={periodId ?? ""}
              onChange={(e) => {
                setPeriodId(e.target.value ? Number(e.target.value) : null);
                if (error) setError(undefined);
              }}
            >
              <option value="">
                {periods.isPending
                  ? "Loading finalized periods…"
                  : periods.isError
                    ? "Could not load periods"
                    : finalized.length === 0
                      ? "No finalized period available"
                      : "Choose a finalized period"}
              </option>
              {finalized.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Disbursement Method" required>
          {(f) => (
            <Select
              {...f}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <ServerError message={serverError} />

        <div className="mt-2 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            className="bg-brand-500 hover:bg-brand-600 font-bold text-white"
          >
            Create Batch
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ============================================================================
// 2. Dedicated Payment Editor Modal (replaces disruptive inline edit)
// ============================================================================

function PaymentEditorDialog({
  payment,
  onClose,
}: {
  payment: PayrollPayment;
  onClose: () => void;
}) {
  const update = useUpdatePayment();
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [reference, setReference] = useState(payment.bankReference ?? "");
  const [serverError, setServerError] = useState<string | null>(null);

  const choices = useMemo(
    () => [payment.status, ...PAYMENT_TRANSITIONS[payment.status]],
    [payment.status],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const ref = reference.trim();

    try {
      await update.mutateAsync({
        id: payment.id,
        body: {
          ...(status !== payment.status ? { status } : {}),
          ...(ref !== (payment.bankReference ?? "")
            ? { bankReference: ref }
            : {}),
        },
      });
      toast({
        title: `Payment record updated`,
        description: `Updated status for ${payment.employee.fullName}.`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Update Employee Payment" size="md">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-1"
        noValidate
      >
        {/* Employee Summary Card */}
        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-sm">
              {payment.employee.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                {payment.employee.fullName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {payment.employee.employeeCode} ·{" "}
                {payment.employee.bankDetails?.bankName || "No Bank Info"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Disbursement
            </p>
            <p className="text-base font-bold text-brand-600 dark:text-sky-300">
              {money(payment.amount)}
            </p>
          </div>
        </div>

        <FormField label="Payment Status" required>
          {(f) => (
            <Select
              {...f}
              value={status}
              onChange={(e) => setStatus(e.target.value as PaymentStatus)}
            >
              {choices.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Bank Reference / UTR Number"
          hint="e.g. UTR number from bank statement or cheque clearance number."
        >
          {(f) => (
            <Input
              {...f}
              placeholder="e.g. UTIB00012345678"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </FormField>

        <ServerError message={serverError} />

        <div className="mt-2 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={update.isPending}
            className="bg-brand-500 hover:bg-brand-600 font-bold text-white"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ============================================================================
// 3. Batch Detail Modal (Content-Aware, Reusable, with in-modal Search & Export)
// ============================================================================

function BatchDetailDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const canProcess = usePermission(PAYMENT_BATCH_WRITE);
  const canEditPayment = usePermission(PAYMENT_WRITE);
  const query = usePaymentBatch(id);
  const process = useProcessPaymentBatch();
  const { toast } = useToast();

  const [confirming, setConfirming] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PayrollPayment | null>(
    null,
  );
  const [exportingBankFile, setExportingBankFile] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // In-modal search and status filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");

  const batch = query.data;
  const rawPayments = batch?.payments ?? [];

  // Filtered payments inside modal
  const filteredPayments = useMemo(() => {
    let result = rawPayments;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.employee.fullName.toLowerCase().includes(q) ||
          p.employee.employeeCode.toLowerCase().includes(q) ||
          (p.employee.bankDetails?.accountNumber || "").includes(q) ||
          (p.bankReference || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }
    return result;
  }, [rawPayments, searchTerm, statusFilter]);

  // Payment status breakdown
  const stats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let failed = 0;
    rawPayments.forEach((p) => {
      if (p.status === "PAID") paid++;
      else if (p.status === "PENDING") pending++;
      else if (p.status === "FAILED") failed++;
    });
    return { paid, pending, failed };
  }, [rawPayments]);

  async function handleProcess() {
    setActionError(null);
    try {
      await process.mutateAsync(id);
      toast({
        title: "Payment batch processed successfully",
        description: "All pending payments have been updated to Paid status.",
        variant: "success",
      });
      setConfirming(false);
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  async function handleExportBankCsv() {
    setActionError(null);
    setExportingBankFile(true);
    try {
      const file = await exportPaymentBatch(id);
      downloadText(file.fileName, file.content);
      toast({
        title: "Bank advice exported",
        description: `Saved ${file.fileName} for upload to corporate banking portal.`,
        variant: "success",
      });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setExportingBankFile(false);
    }
  }

  function handleExportReconCsv() {
    if (!batch) return;
    exportBatchPaymentsCsv(batch, filteredPayments);
    setExportDropdownOpen(false);
  }

  function handleExportReconExcel() {
    if (!batch) return;
    exportBatchPaymentsExcel(batch, filteredPayments);
    setExportDropdownOpen(false);
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={
          batch
            ? `Payment Batch: ${batch.batchNumber}`
            : "Payment Batch Details"
        }
        size="5xl"
      >
        <div className="flex flex-col gap-4">
          <QueryState query={query} area="this payment batch" />

          {batch ? (
            <>
              {/* Executive Batch Summary Banner */}
              <div className="rounded-2xl border border-sky-100 bg-linear-to-r from-sky-50/70 via-white to-blue-50/50 p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#0a3271] dark:text-white">
                          Batch #{batch.batchNumber}
                        </h3>
                        <StatusPill status={batch.status} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {periodLabel(batch.payrollPeriod)} · Generated{" "}
                        {isoDate(batch.generatedAt)}
                        {batch.generator
                          ? ` by ${batch.generator.fullName}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* High Level Numbers */}
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total Payout
                      </p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {money(batch.totalAmount)}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Beneficiaries
                      </p>
                      <p className="text-xl font-bold text-[#0a3271] dark:text-white">
                        {batch.totalEmployees}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          Employees
                        </span>
                      </p>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Status Breakdown
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-600 font-bold">
                          {stats.paid} Paid
                        </span>
                        {" · "}
                        <span className="text-amber-600 font-bold">
                          {stats.pending} Pending
                        </span>
                        {stats.failed > 0 && (
                          <span className="text-rose-600 font-bold">
                            {" · "}
                            {stats.failed} Failed
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subtext info */}
                <div className="mt-3 flex items-center gap-2 border-t border-sky-100/80 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span>
                    Bank file contains unmasked corporate accounts for clearing
                    house processing. Treat securely.
                  </span>
                  {batch.processedAt && (
                    <span className="ml-auto font-semibold text-emerald-600 dark:text-emerald-400">
                      Disbursed on {isoDate(batch.processedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action and Processing Confirmations */}
              {confirming && (
                <Alert variant="warning" title="Process this payment batch?">
                  <div className="flex flex-col gap-3">
                    <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      Every payment still marked <strong>Pending</strong> will
                      be transitioned to <strong>Paid</strong> with today&apos;s
                      timestamp. Execute this after your bank portal has
                      confirmed acceptance of the transfer file. This action
                      cannot be bulk-reversed.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        loading={process.isPending}
                        onClick={() => void handleProcess()}
                        className="bg-amber-600 hover:bg-amber-700 font-bold text-white text-xs"
                      >
                        Yes, Confirm and Mark as Paid
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={process.isPending}
                        onClick={() => setConfirming(false)}
                        className="text-xs"
                      >
                        Not Yet
                      </Button>
                    </div>
                  </div>
                </Alert>
              )}

              <ServerError message={actionError} />

              {/* In-Modal Filter & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex flex-1 flex-wrap items-center gap-2 min-w-60">
                  {/* Search within batch */}
                  <div className="relative flex-1 min-w-50">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Find employee, account # or UTR..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-900 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status filter within batch */}
                  <Select
                    className="w-36 text-xs py-1.5"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as PaymentStatus | "")
                    }
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Select>

                  {(searchTerm || statusFilter) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2">
                  {/* Export Options Dropdown */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setExportDropdownOpen((prev) => !prev)}
                      className="border-sky-200 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:text-slate-200"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
                      Export
                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                    </Button>

                    {exportDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setExportDropdownOpen(false)}
                        />
                        <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-sky-100 bg-white py-1.5 shadow-xl ring-1 ring-black/5 z-50 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => {
                              void handleExportBankCsv();
                              setExportDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <FileText className="h-4 w-4 text-brand-500" />
                            Bank Advice File (.csv)
                          </button>
                          <button
                            type="button"
                            onClick={handleExportReconCsv}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <FileSpreadsheet className="h-4 w-4 text-sky-500" />
                            Reconciliation (.csv)
                          </button>
                          <button
                            type="button"
                            onClick={handleExportReconExcel}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                            Reconciliation (.xls)
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Process Batch Button */}
                  {canProcess && batch.status === "PENDING" && !confirming ? (
                    <Button
                      size="sm"
                      onClick={() => setConfirming(true)}
                      className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Process Batch
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Payments Table */}
              {filteredPayments.length === 0 ? (
                <EmptyState
                  title="No payments match"
                  description={
                    searchTerm || statusFilter
                      ? "No payments match the search query or status filter."
                      : "This batch currently contains no payments."
                  }
                />
              ) : (
                <div className="rounded-xl border border-sky-100 overflow-x-auto dark:border-slate-800">
                  <DataTable<PayrollPayment>
                    caption="Batch Employee Payments"
                    rows={filteredPayments}
                    getRowKey={(r) => String(r.id)}
                    columns={[
                      {
                        header: "Employee",
                        cell: (r) => (
                          <div className="flex items-center gap-2.5 py-0.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 font-bold text-xs text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                              {r.employee.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {r.employee.fullName}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {r.employee.employeeCode}
                              </span>
                            </div>
                          </div>
                        ),
                      },
                      {
                        header: "Bank & Account",
                        cell: (r) =>
                          r.employee.bankDetails ? (
                            <div className="flex flex-col text-xs">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {r.employee.bankDetails.bankName}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Acc: {r.employee.bankDetails.accountNumber}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" />
                              Missing Bank
                            </span>
                          ),
                      },
                      {
                        header: "Net Amount",
                        cell: (r) => (
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {money(r.amount)}
                          </span>
                        ),
                        className: "text-right whitespace-nowrap",
                        headerClassName: "text-right",
                      },
                      {
                        header: "Method",
                        cell: (r) => (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {METHOD_LABEL[r.paymentMethod]}
                          </span>
                        ),
                      },
                      {
                        header: "Status",
                        cell: (r) => <StatusPill status={r.status} />,
                      },
                      {
                        header: "Reference / UTR",
                        cell: (r) => (
                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            {r.bankReference ? (
                              <span className="font-semibold">
                                {r.bankReference}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </span>
                        ),
                      },
                      {
                        header: "Credited On",
                        cell: (r) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {r.creditedAt ? isoDate(r.creditedAt) : "—"}
                          </span>
                        ),
                      },
                      {
                        header: "Actions",
                        cell: (r) =>
                          canEditPayment &&
                          PAYMENT_TRANSITIONS[r.status].length > 0 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Update payment for ${r.employee.fullName}`}
                              onClick={() => setEditingPayment(r)}
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              Update
                            </Button>
                          ) : null,
                      },
                    ]}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      </Dialog>

      {/* Payment Update Modal */}
      {editingPayment && (
        <PaymentEditorDialog
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// 4. Main Payments Panel View
// ============================================================================

export function PaymentsPanel() {
  const canList = usePermission(PAYMENT_BATCH_READ);
  const canWrite = usePermission(PAYMENT_BATCH_WRITE);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  // Fetch batches
  const query = usePaymentBatches(
    {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(periodId ? { payrollPeriodId: periodId } : {}),
    },
    canList,
  );

  const allBatches = query.data?.data ?? [];

  // Filter batches by search keyword
  const filteredBatches = useMemo(() => {
    if (!search.trim()) return allBatches;
    const q = search.toLowerCase().trim();
    return allBatches.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        periodLabel(b.payrollPeriod).toLowerCase().includes(q) ||
        (b.generator?.fullName || "").toLowerCase().includes(q),
    );
  }, [allBatches, search]);

  // Aggregate KPI summary metrics across fetched batches
  const {
    totalBatchesCount,
    totalDisbursedAmount,
    pendingBatchesCount,
    totalEmployeesCovered,
  } = useMemo(() => {
    let disbursed = 0;
    let pending = 0;
    let employees = 0;

    allBatches.forEach((b) => {
      const amt = Number(b.totalAmount) || 0;
      employees += b.totalEmployees;
      if (b.status === "PROCESSED") {
        disbursed += amt;
      } else if (b.status === "PENDING" || b.status === "PROCESSING") {
        pending++;
      }
    });

    return {
      totalBatchesCount: allBatches.length,
      totalDisbursedAmount: disbursed,
      pendingBatchesCount: pending,
      totalEmployeesCovered: employees,
    };
  }, [allBatches]);

  const hasFilters = Boolean(status || periodId || search.trim());

  function handleClearFilters() {
    setStatus("");
    setPeriodId(null);
    setSearch("");
    setPage(1);
  }

  function handleExportCsv() {
    exportPaymentBatchesCsv(filteredBatches);
    setExportOpen(false);
  }

  function handleExportExcel() {
    exportPaymentBatchesExcel(filteredBatches);
    setExportOpen(false);
  }

  // Permission fallback
  if (!canList) {
    return (
      <Alert
        variant="info"
        title="Payment Batches Require Organization-Wide Access"
      >
        Payment batches process compensation across the entire organization.
        Viewing and executing disbursement runs requires the organization-wide (
        <code>.all</code>) payments permission. Contact your system
        administrator if access is needed.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Interactive KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Payment Batches */}
        <button
          type="button"
          onClick={handleClearFilters}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            !hasFilters
              ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
              : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Total Batches
              </p>
              {!hasFilters && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  All
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalBatchesCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Disbursement runs created
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
            <CreditCard className="h-5 w-5" />
          </div>
        </button>

        {/* Total Net Disbursed */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Total Net Disbursed
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {money(totalDisbursedAmount)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Completed batch payouts
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Pending Processing */}
        <button
          type="button"
          onClick={() => {
            setStatus("PENDING");
            setPage(1);
          }}
          className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
            status === "PENDING"
              ? "border-2 border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-slate-800"
              : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Batches
              </p>
              {status === "PENDING" && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                  Active
                </span>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {pendingBatchesCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Awaiting bank clearance
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* Total Employees Covered */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Employees Benefited
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalEmployeesCovered}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Cumulative employee transfers
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Unified Single-Baseline Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-55">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search batch #, period, or creator..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-xs text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <Select
            aria-label="Filter by batch status"
            className="w-full sm:w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as BatchStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {BATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>

          {/* Period Selector */}
          <div className="w-full sm:w-48">
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
          </div>

          {hasFilters && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearFilters}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {/* Action Buttons: Export CSV / Excel & New Batch */}
        <div className="flex items-center gap-2 relative">
          {/* Export Dropdown Menu */}
          <div className="relative">
            <Button
              variant="secondary"
              onClick={() => setExportOpen((prev) => !prev)}
              disabled={allBatches.length === 0}
              className="border-sky-200 hover:border-brand-400 text-slate-700 dark:text-slate-200 font-semibold text-xs"
            >
              <Download className="mr-1.5 h-4 w-4 text-brand-500" />
              Export
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
            </Button>

            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-sky-100 bg-white py-1.5 shadow-xl ring-1 ring-black/5 z-50 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-4 w-4 text-brand-500" />
                    Export CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50/70 hover:text-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Excel (.xls)
                  </button>
                </div>
              </>
            )}
          </div>

          {canWrite && (
            <Button
              onClick={() => setCreating(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Payment Batch
            </Button>
          )}
        </div>
      </div>

      <QueryState query={query} area="payment batches" />

      {/* Main Payment Batches Table */}
      <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {filteredBatches.length === 0 ? (
          <EmptyState
            title="No Payment Batches Found"
            description={
              hasFilters
                ? "No payment batches match your filter or search criteria. Try resetting filters."
                : "Create a batch once a monthly payroll period has been finalized."
            }
          />
        ) : (
          <>
            <DataTable<PaymentBatch>
              caption="Payment Batches Directory"
              rows={filteredBatches}
              getRowKey={(r) => String(r.id)}
              columns={[
                {
                  header: "Batch #",
                  cell: (r) => (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {r.batchNumber}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Payroll Period",
                  cell: (r) => (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {periodLabel(r.payrollPeriod)}
                    </div>
                  ),
                },
                {
                  header: "Employees",
                  cell: (r) => (
                    <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{r.totalEmployees}</span>
                    </div>
                  ),
                  className: "text-right",
                  headerClassName: "text-right",
                },
                {
                  header: "Total Net Amount",
                  cell: (r) => (
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {money(r.totalAmount)}
                    </span>
                  ),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
                {
                  header: "Status",
                  cell: (r) => <StatusPill status={r.status} />,
                },
                {
                  header: "Created",
                  cell: (r) => (
                    <div className="flex flex-col text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {isoDate(r.generatedAt)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {r.generator ? r.generator.fullName : "System"}
                      </span>
                    </div>
                  ),
                },
                {
                  header: "Processed",
                  cell: (r) => (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {r.processedAt ? (
                        <span className="text-emerald-600 font-semibold dark:text-emerald-400">
                          {isoDate(r.processedAt)}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Awaiting Clearance
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Open batch ${r.batchNumber}`}
                        onClick={() => setOpenId(r.id)}
                        className="text-xs font-semibold hover:border-brand-400 text-brand-600 dark:text-sky-300"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Details
                      </Button>
                    </div>
                  ),
                },
              ]}
            />

            <div className="mt-4">
              <Pagination
                page={page}
                totalPages={query.data?.meta?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {creating && (
        <NewBatchDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}

      {openId && (
        <BatchDetailDialog id={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
