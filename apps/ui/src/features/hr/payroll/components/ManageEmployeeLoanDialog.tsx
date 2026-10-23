"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Plus,
  TrendingDown,
  Wallet,
  X,
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
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { describeError, isoDate, money } from "../format";
import {
  useCreateLoan,
  useDecideLoanSkip,
  useLoans,
  useRequestLoanSkip,
  useSalaries,
} from "../hooks";
import { LOAN_APPROVE, LOAN_WRITE } from "../permissions";
import { createLoanSchema, fieldErrors, loanSkipSchema } from "../schema";
import type { Loan, LoanSkipRequest } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import {
  LoanDecision,
  LoanStages,
  PrepaymentForm,
  PrepaymentsTable,
} from "./LoanApprovalParts";
import { outstanding } from "./LoanDialogs";
import { OpenPeriodSelect } from "./OpenPeriodSelect";
import { StatusPill } from "./PayrollStatusBadge";

export interface ManageEmployeeData {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName?: string;
  status: string;
}

export function ManageEmployeeLoanDialog({
  employee,
  onClose,
  initialTab = "manage",
}: {
  employee: ManageEmployeeData;
  onClose: () => void;
  initialTab?: "manage" | "history";
}) {
  const [activeTab, setActiveTab] = useState<"manage" | "history">(initialTab);
  const canWrite = usePermission(LOAN_WRITE);
  const canApprove = usePermission(LOAN_APPROVE);
  const { toast } = useToast();

  // Queries for this employee
  const loansQuery = useLoans(
    { employeeId: employee.id, page: 1, limit: 50 },
    true,
  );
  const employeeLoans = loansQuery.data?.data ?? [];

  const salariesQuery = useSalaries(
    { employeeId: employee.id, page: 1, limit: 5 },
    true,
  );
  const employeeSalaries = salariesQuery.data?.data ?? [];

  // Active salary structure calculation
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentSalary = useMemo(() => {
    const inForce = employeeSalaries.find(
      (s) =>
        s.effectiveFrom <= todayStr &&
        (!s.effectiveTo || s.effectiveTo >= todayStr),
    );
    return inForce ?? employeeSalaries[0] ?? null;
  }, [employeeSalaries, todayStr]);

  const grossSalary = Number(currentSalary?.grossMonthly || 0);

  // Active running loans for this employee
  const activeLoans = useMemo(
    () => employeeLoans.filter((l) => l.status === "ACTIVE"),
    [employeeLoans],
  );

  const pendingLoans = useMemo(
    () =>
      employeeLoans.filter(
        (l) => l.status === "PENDING_HR" || l.status === "PENDING_ADMIN",
      ),
    [employeeLoans],
  );

  const approvedLoans = useMemo(
    () =>
      employeeLoans.filter(
        (l) => l.status === "ACTIVE" || l.status === "CLOSED",
      ),
    [employeeLoans],
  );

  // Current monthly EMI commitments
  const currentEmi = useMemo(
    () => activeLoans.reduce((sum, l) => sum + Number(l.emiAmount || 0), 0),
    [activeLoans],
  );

  const netSalary = Math.max(0, grossSalary - currentEmi);
  const maxLoanCapacity = grossSalary > 0 ? grossSalary * 3 : 0;

  // New Loan Form State
  const createLoanMutation = useCreateLoan();
  const [principal, setPrincipal] = useState("");
  const [months, setMonths] = useState("6");
  const [emi, setEmi] = useState("");
  const [disbursed, setDisbursed] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overLimit, setOverLimit] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Auto-calculated suggested EMI
  const suggestedEmi = useMemo(() => {
    const p = Number(principal);
    const m = Number(months);
    if (p > 0 && m > 0) {
      return Math.ceil(p / m);
    }
    return null;
  }, [principal, months]);

  // Update EMI when suggested changes and user hasn't overridden
  const handlePrincipalChange = (val: string) => {
    setPrincipal(val);
    const p = Number(val);
    const m = Number(months);
    if (p > 0 && m > 0) {
      setEmi(String(Math.ceil(p / m)));
    }
    if (maxLoanCapacity > 0 && p > maxLoanCapacity) {
      setOverLimit(true);
    } else {
      setOverLimit(false);
    }
  };

  const handleMonthsChange = (val: string) => {
    setMonths(val);
    const p = Number(principal);
    const m = Number(val);
    if (p > 0 && m > 0) {
      setEmi(String(Math.ceil(p / m)));
    }
  };

  async function handleCreateLoanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const terms = {
      employeeId: employee.id,
      principalAmount: principal,
      emiAmount: emi || (suggestedEmi ? String(suggestedEmi) : ""),
      emiMonths: months,
      disbursedDate: disbursed,
      reason,
      overrideReason: overrideReason || undefined,
    };

    const parsed = createLoanSchema.safeParse(terms);
    if (!parsed.success) {
      setCreateErrors(fieldErrors(parsed.error));
      return;
    }

    setCreateErrors({});
    setServerError(null);

    try {
      const res = await createLoanMutation.mutateAsync(parsed.data);
      toast({
        title: `Loan ${res.loanNumber} created for ${employee.fullName} — awaiting review`,
        variant: "success",
      });
      setPrincipal("");
      setMonths("6");
      setEmi("");
      setReason("");
      setOverrideReason("");
      setOverLimit(false);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "LOAN_OVER_LIMIT") {
        setOverLimit(true);
      }
      setServerError(describeError(err));
    }
  }

  // Skip EMI Form State
  const skipMutation = useRequestLoanSkip();
  const [selectedLoanIdForSkip, setSelectedLoanIdForSkip] = useState<
    number | null
  >(activeLoans[0]?.id ?? null);
  const [skipPeriodId, setSkipPeriodId] = useState<number | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipErrors, setSkipErrors] = useState<Record<string, string>>({});
  const [skipServerError, setSkipServerError] = useState<string | null>(null);

  async function handleSkipSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoanIdForSkip) {
      setSkipServerError("Please select an active loan to skip an EMI.");
      return;
    }
    const parsed = loanSkipSchema.safeParse({
      payrollPeriodId: skipPeriodId ?? undefined,
      reason: skipReason,
    });
    if (!parsed.success) {
      setSkipErrors(fieldErrors(parsed.error));
      return;
    }
    setSkipErrors({});
    setSkipServerError(null);
    try {
      await skipMutation.mutateAsync({
        loanId: selectedLoanIdForSkip,
        body: parsed.data,
      });
      toast({
        title: "EMI skip request submitted successfully",
        variant: "success",
      });
      setSkipReason("");
      setSkipPeriodId(null);
    } catch (err) {
      setSkipServerError(describeError(err));
    }
  }

  // Sub-metrics for History & Payments Tab
  const totalApprovedAmount = useMemo(
    () =>
      approvedLoans.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0),
    [approvedLoans],
  );

  const totalOutstandingAmount = useMemo(
    () =>
      activeLoans.reduce((sum, l) => sum + Math.round(outstanding(l) / 100), 0),
    [activeLoans],
  );

  const totalRepaidInstallments = useMemo(() => {
    return employeeLoans.reduce((acc, l) => {
      return acc + l.repayments.filter((r) => r.status === "PAID").length;
    }, 0);
  }, [employeeLoans]);

  // Selected loan for inspecting repayments / prepayments
  const [selectedHistoryLoanId, setSelectedHistoryLoanId] = useState<
    number | null
  >(null);
  const activeHistoryLoan = useMemo(() => {
    if (selectedHistoryLoanId) {
      return (
        employeeLoans.find((l) => l.id === selectedHistoryLoanId) ??
        employeeLoans[0] ??
        null
      );
    }
    return employeeLoans[0] ?? null;
  }, [employeeLoans, selectedHistoryLoanId]);

  const [prepaying, setPrepaying] = useState(false);

  return (
    <Dialog
      open
      onClose={onClose}
      showHeader={false}
      size="4xl"
      contentClassName="p-0 flex flex-col min-h-0"
    >
      {/* Header Bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-sky-100 bg-sky-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 font-bold text-base dark:bg-brand-500/20 dark:text-sky-300">
            {employee.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-theme-lg font-bold text-gray-900 dark:text-white">
                {employee.fullName}
              </h2>
              <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                ({employee.employeeCode})
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                {employee.status.toLowerCase()}
              </span>
            </div>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {employee.departmentName || "General Department"} · Loans
              Management
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="shrink-0 flex border-b border-gray-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={`border-b-2 py-3 px-4 text-theme-sm font-bold transition-colors ${
            activeTab === "manage"
              ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-sky-300"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Manage Loans
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`border-b-2 py-3 px-4 text-theme-sm font-bold transition-colors ${
            activeTab === "history"
              ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-sky-300"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          History & Payments
        </button>
      </div>

      {/* Primary Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
        {activeTab === "manage" ? (
          <>
            {/* 1. Salary Summary Card (Matching Reference Image 2) */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <h3 className="text-theme-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Salary Summary
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Gross Salary
                  </span>
                  <p className="mt-1 text-theme-base font-bold text-gray-900 dark:text-white">
                    {grossSalary > 0 ? money(grossSalary) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Current EMI
                  </span>
                  <p
                    className={`mt-1 text-theme-base font-bold ${
                      currentEmi > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {money(currentEmi)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Net Disposable
                  </span>
                  <p className="mt-1 text-theme-base font-bold text-emerald-700 dark:text-emerald-400">
                    {grossSalary > 0 ? money(netSalary) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Max Loan (3× Gross)
                  </span>
                  <p className="mt-1 text-theme-base font-bold text-[#0a3271] dark:text-sky-300">
                    {grossSalary > 0 ? money(maxLoanCapacity) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. New Loan Request Card (Matching Reference Image 2) */}
            {canWrite ? (
              <div className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-brand-600 dark:text-sky-400" />
                  <h3 className="text-theme-md font-bold text-[#0a3271] dark:text-white">
                    New Loan Request
                  </h3>
                </div>

                <form
                  onSubmit={handleCreateLoanSubmit}
                  className="mt-4 flex flex-col gap-4"
                  noValidate
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Amount (₹)"
                      required
                      error={createErrors.principalAmount}
                      hint={
                        maxLoanCapacity > 0
                          ? `Max standard limit: ₹${maxLoanCapacity.toLocaleString("en-IN")}`
                          : undefined
                      }
                    >
                      {(f) => (
                        <Input
                          {...f}
                          type="number"
                          min={1}
                          placeholder="e.g. 25000"
                          value={principal}
                          onChange={(e) =>
                            handlePrincipalChange(e.target.value)
                          }
                        />
                      )}
                    </FormField>

                    <FormField
                      label="EMI Months (0 = full)"
                      required
                      error={createErrors.emiMonths}
                      hint={
                        suggestedEmi
                          ? `Calculated monthly EMI: ₹${suggestedEmi.toLocaleString("en-IN")}`
                          : undefined
                      }
                    >
                      {(f) => (
                        <Input
                          {...f}
                          type="number"
                          min={1}
                          placeholder="6"
                          value={months}
                          onChange={(e) => handleMonthsChange(e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Reason" error={createErrors.reason}>
                      {(f) => (
                        <Input
                          {...f}
                          placeholder="Medical, Education, Emergency, etc."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      )}
                    </FormField>

                    <FormField
                      label="Disbursement Date"
                      required
                      hint="First EMI will be deducted in next payroll cycle"
                      error={createErrors.disbursedDate}
                    >
                      {(f) => (
                        <Input
                          {...f}
                          type="date"
                          value={disbursed}
                          onChange={(e) => setDisbursed(e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>

                  {overLimit ? (
                    <FormField
                      label="Override reason"
                      required
                      hint="The requested principal exceeds the 3× gross salary threshold. Provide justification for organization-wide approval."
                      error={createErrors.overrideReason}
                    >
                      {(f) => (
                        <Textarea
                          {...f}
                          rows={2}
                          placeholder="Justification for exceeding loan policy limit..."
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                        />
                      )}
                    </FormField>
                  ) : null}

                  <ServerError message={serverError} />

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      loading={createLoanMutation.isPending}
                      className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6"
                    >
                      Submit Loan Request
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            {/* 3. Skip EMI Request Card (Matching Reference Image 2) */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-theme-md font-bold text-amber-900 dark:text-amber-300">
                    Skip EMI Request
                  </h3>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    Request to skip EMI for a specific month (deferring the
                    installment to the end of the loan tenure)
                  </p>
                </div>
              </div>

              {activeLoans.length === 0 ? (
                <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                  This employee does not currently have any active running loans
                  eligible for an EMI skip.
                </p>
              ) : (
                <form
                  onSubmit={handleSkipSubmit}
                  className="mt-4 flex flex-col gap-4"
                  noValidate
                >
                  {activeLoans.length > 1 ? (
                    <FormField label="Select Loan" required>
                      {(f) => (
                        <Select
                          {...f}
                          value={selectedLoanIdForSkip ?? ""}
                          onChange={(e) =>
                            setSelectedLoanIdForSkip(Number(e.target.value))
                          }
                        >
                          {activeLoans.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.loanNumber} — {money(l.principalAmount)} (
                              {money(l.emiAmount)}/mo)
                            </option>
                          ))}
                        </Select>
                      )}
                    </FormField>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Payroll Period / Month"
                      required
                      error={skipErrors.payrollPeriodId}
                    >
                      {(f) => (
                        <OpenPeriodSelect
                          {...f}
                          value={skipPeriodId}
                          onChange={setSkipPeriodId}
                          emptyLabel="Choose payroll period"
                        />
                      )}
                    </FormField>

                    <FormField
                      label="Reason"
                      required
                      error={skipErrors.reason}
                    >
                      {(f) => (
                        <Input
                          {...f}
                          placeholder="Emergency, Festive month, Medical, etc."
                          value={skipReason}
                          onChange={(e) => setSkipReason(e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>

                  <ServerError message={skipServerError} />

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      loading={skipMutation.isPending}
                      variant="secondary"
                      className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                    >
                      Request Skip
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* 4. Loan Requests List for this Employee */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-theme-md font-bold text-gray-900 dark:text-white">
                  Loan Requests ({employeeLoans.length})
                </h3>
              </div>

              {employeeLoans.length === 0 ? (
                <div className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                  No loan requests found for this employee.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-gray-100 dark:divide-slate-800">
                  {employeeLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {loan.loanNumber}
                          </span>
                          <StatusPill status={loan.status} />
                          <span className="text-theme-xs text-gray-500">
                            Disbursed: {isoDate(loan.disbursedDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-theme-sm">
                          <span>
                            Principal:{" "}
                            <strong>{money(loan.principalAmount)}</strong>
                          </span>
                          <span>
                            EMI: <strong>{money(loan.emiAmount)}</strong> ×{" "}
                            {loan.emiMonths} mos
                          </span>
                          <span>
                            Outstanding:{" "}
                            <strong className="text-rose-600 dark:text-rose-400">
                              {money(outstanding(loan) / 100)}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Maker-Checker stages / decision if pending */}
                      <LoanDecision loan={loan} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Tab 2: History & Payments (Matching Reference Image 3) */}
            {/* 4 Sub-KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Total Loans */}
              <div className="rounded-2xl border border-sky-200/90 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                    Total Loans
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-[#0a3271] dark:text-white">
                  {employeeLoans.length}
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Lifetime requests
                </p>
              </div>

              {/* Approved Loans */}
              <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Approved
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {approvedLoans.length}
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {money(totalApprovedAmount)}
                </p>
              </div>

              {/* Pending Loans */}
              <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Pending
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {pendingLoans.length}
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500">Under review</p>
              </div>

              {/* Outstanding Balance */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    Outstanding
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {money(totalOutstandingAmount)}
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Repaid: {totalRepaidInstallments} EMIs
                </p>
              </div>
            </div>

            {/* Repayment Schedule & History Card (Matching Reference Image 3) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-brand-600 dark:text-sky-400" />
                  <h3 className="text-theme-md font-bold text-gray-900 dark:text-white">
                    Loan History & EMI Payments
                  </h3>
                </div>

                {employeeLoans.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-theme-xs text-gray-500">Loan:</span>
                    <Select
                      className="w-48 text-theme-xs"
                      value={activeHistoryLoan?.id ?? ""}
                      onChange={(e) =>
                        setSelectedHistoryLoanId(Number(e.target.value))
                      }
                    >
                      {employeeLoans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.loanNumber} ({money(l.principalAmount)})
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>

              {!activeHistoryLoan ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  No loans found.
                </div>
              ) : activeHistoryLoan.repayments.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No EMI schedule generated yet for loan{" "}
                  {activeHistoryLoan.loanNumber} (created once approved).
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-3 rounded-xl dark:bg-slate-800/60">
                    <div className="flex items-center gap-4 text-theme-xs">
                      <span>
                        Sanctioned:{" "}
                        <strong>
                          {money(activeHistoryLoan.principalAmount)}
                        </strong>
                      </span>
                      <span>
                        EMI:{" "}
                        <strong>{money(activeHistoryLoan.emiAmount)}</strong>
                      </span>
                      <span>
                        Tenure:{" "}
                        <strong>{activeHistoryLoan.emiMonths} months</strong>
                      </span>
                      <span>
                        Disbursed:{" "}
                        <strong>
                          {isoDate(activeHistoryLoan.disbursedDate)}
                        </strong>
                      </span>
                    </div>
                    {canWrite &&
                    activeHistoryLoan.status === "ACTIVE" &&
                    !prepaying ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPrepaying(true)}
                      >
                        Record prepayment
                      </Button>
                    ) : null}
                  </div>

                  {prepaying && (
                    <PrepaymentForm
                      loan={activeHistoryLoan}
                      outstandingRupees={Math.round(
                        outstanding(activeHistoryLoan) / 100,
                      )}
                      onDone={() => setPrepaying(false)}
                    />
                  )}

                  <DataTable
                    caption={`Repayment Schedule for ${activeHistoryLoan.loanNumber}`}
                    rows={activeHistoryLoan.repayments}
                    getRowKey={(r) => String(r.id)}
                    columns={[
                      { header: "#", cell: (r) => r.installmentNo },
                      { header: "Due Date", cell: (r) => isoDate(r.dueDate) },
                      {
                        header: "Amount",
                        cell: (r) => money(r.amount),
                        className: "text-right whitespace-nowrap",
                        headerClassName: "text-right",
                      },
                      {
                        header: "Status",
                        cell: (r) => <StatusPill status={r.status} />,
                      },
                      {
                        header: "Paid on",
                        cell: (r) => (r.paidAt ? isoDate(r.paidAt) : "—"),
                      },
                    ]}
                  />

                  {activeHistoryLoan.prepayments?.length ? (
                    <div className="mt-2">
                      <h4 className="text-theme-sm font-bold text-gray-900 dark:text-white mb-2">
                        Prepayments
                      </h4>
                      <PrepaymentsTable
                        loan={activeHistoryLoan}
                        selfService={false}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
