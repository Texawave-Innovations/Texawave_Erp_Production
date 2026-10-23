"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { describeError, money, periodLabel } from "../format";
import { useBonuses, useCreateBonus, useDecideBonus } from "../hooks";
import {
  BONUS_APPROVE,
  BONUS_READ,
  BONUS_WRITE,
  BONUS_WRITE_ALL,
} from "../permissions";
import { GratuityDialog, StatutoryBonusDialog } from "./BonusToolsDialogs";
import { createBonusSchema, fieldErrors } from "../schema";
import {
  BONUS_FILTER_STATUSES,
  BONUS_TYPES,
  type Bonus,
  type BonusType,
} from "../types";
import { BonusCard } from "./BonusCard";
import { DialogActions, ServerError } from "./DialogParts";
import { OpenPeriodSelect } from "./OpenPeriodSelect";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { QueryState } from "./QueryState";
import { YearlyBonusMatrix } from "./YearlyBonusMatrix";

const PAGE_SIZE = 12;

const TYPE_LABEL: Record<BonusType, string> = {
  FESTIVAL: "Festival Bonus",
  PERFORMANCE: "Performance Bonus",
  STATUTORY: "Statutory Bonus",
  ANNUAL: "Annual Bonus",
  SPOT: "Spot Award",
  GRATUITY: "Gratuity Settlement",
};

/** Raised manually; gratuity comes from its calculation */
const MANUAL_TYPES = BONUS_TYPES.filter((t) => t !== "GRATUITY");

function NewBonusDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateBonus();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [bonusType, setBonusType] = useState<BonusType | "">("");
  const [amount, setAmount] = useState("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createBonusSchema.safeParse({
      employeeId: employee?.id,
      bonusType: bonusType || undefined,
      amount,
      payrollPeriodId: periodId ?? undefined,
      reason,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await create.mutateAsync(parsed.data);
      toast({
        title: `Bonus created for ${employee?.fullName} — awaiting approval`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="New bonus">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required error={errors.employeeId}>
          {(f) => (
            <EmployeePicker {...f} value={employee} onChange={setEmployee} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Bonus type" required error={errors.bonusType}>
            {(f) => (
              <Select
                {...f}
                value={bonusType}
                onChange={(e) => setBonusType(e.target.value as BonusType)}
              >
                <option value="">Choose a type</option>
                {MANUAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Amount (₹)" required error={errors.amount}>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Pay with payroll period"
          hint="Optional. An approved bonus is paid by this period's payroll run."
          error={errors.payrollPeriodId}
        >
          {(f) => (
            <OpenPeriodSelect
              {...f}
              value={periodId}
              onChange={setPeriodId}
              emptyLabel="Not assigned yet"
            />
          )}
        </FormField>
        <FormField label="Reason" hint="Optional." error={errors.reason}>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Create bonus"
        />
      </form>
    </Dialog>
  );
}

function DecideBonusDialog({
  bonus,
  decision,
  onClose,
}: {
  bonus: Bonus;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
}) {
  const decide = useDecideBonus();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const approving = decision === "APPROVED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    try {
      await decide.mutateAsync({
        id: bonus.id,
        decision,
        note: note.trim() || undefined,
      });
      toast({
        title: approving ? "Bonus approved" : "Bonus rejected",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={approving ? "Approve bonus" : "Reject bonus"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {TYPE_LABEL[bonus.bonusType]} of{" "}
          <strong>{money(bonus.amount)}</strong> for {bonus.employee.fullName}
          {bonus.payrollPeriod
            ? `, paid with ${periodLabel(bonus.payrollPeriod)}`
            : ""}
          .
        </p>
        <FormField label="Note" hint="Optional.">
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={decide.isPending}
          submitLabel={approving ? "Approve" : "Reject"}
          destructive={!approving}
        />
      </form>
    </Dialog>
  );
}

/** HR → Payroll → Bonuses */
export function BonusesPanel() {
  const canWrite = usePermission(BONUS_WRITE);
  const canApprove = usePermission(BONUS_APPROVE);
  const canRead = usePermission(BONUS_READ);
  const canWriteAll = usePermission(BONUS_WRITE_ALL);

  const userId = useAuthStore((s) => s.user?.userId ?? null);

  // Segmented view toggle: "bonuses" (Operational list) vs "matrix" (Yearly calculation reference view)
  const [activeView, setActiveView] = useState<"bonuses" | "matrix">("bonuses");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    (typeof BONUS_FILTER_STATUSES)[number] | "PAID" | ""
  >("");
  const [bonusType, setBonusType] = useState<BonusType | "">("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [tool, setTool] = useState<"statutory" | "gratuity" | null>(null);
  const [deciding, setDeciding] = useState<{
    bonus: Bonus;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);

  // Summary query across all records for the 4 KPI cards
  const summaryQuery = useBonuses({
    page: 1,
    limit: 100,
  });

  // Filtered bonuses query
  const query = useBonuses({
    page,
    limit: PAGE_SIZE,
    ...(status && status !== "PAID" ? { status } : {}),
    ...(periodId ? { payrollPeriodId: periodId } : {}),
  });

  const rawRows = query.data?.data ?? [];

  // Client-side filtering by search and bonusType
  const rows = useMemo(() => {
    let result = rawRows;

    if (bonusType) {
      result = result.filter((b) => b.bonusType === bonusType);
    }

    if (status === "PAID") {
      result = result.filter((b) => b.status === "PAID");
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((b) => {
        const name = b.employee.fullName.toLowerCase();
        const code = b.employee.employeeCode.toLowerCase();
        const reason = b.reason?.toLowerCase() ?? "";
        return name.includes(q) || code.includes(q) || reason.includes(q);
      });
    }

    return result;
  }, [rawRows, search, bonusType, status]);

  // KPI Metrics Calculation
  const {
    totalCount,
    totalAmount,
    pendingCount,
    pendingAmount,
    approvedCount,
    paidCount,
  } = useMemo(() => {
    const all = summaryQuery.data?.data ?? [];
    const count = summaryQuery.data?.meta?.total ?? all.length;
    const sum = all.reduce((acc, b) => acc + Number(b.amount || 0), 0);

    const pending = all.filter((b) => b.status === "PENDING");
    const approved = all.filter((b) => b.status === "APPROVED");
    const paid = all.filter((b) => b.status === "PAID");

    return {
      totalCount: count,
      totalAmount: sum,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((acc, b) => acc + Number(b.amount || 0), 0),
      approvedCount: approved.length,
      paidCount: paid.length,
    };
  }, [summaryQuery.data]);

  // Maker-checker validation rule
  const mayDecide = (b: Bonus) =>
    canApprove &&
    b.status === "PENDING" &&
    userId != null &&
    b.createdBy !== userId &&
    b.employee.userId !== userId;

  const hasFilters =
    search !== "" || status !== "" || bonusType !== "" || periodId !== null;

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setBonusType("");
    setPeriodId(null);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5 animate-reveal">
      {/* Top Segmented Navigation Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveView("bonuses")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeView === "bonuses"
                ? "bg-white text-[#0a3271] shadow-xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Bonuses & Approvals</span>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                {pendingCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("matrix")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeView === "matrix"
                ? "bg-white text-[#0a3271] shadow-xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Yearly Bonus Calculation</span>
            <span className="rounded-full bg-brand-500/15 px-1.5 py-0.2 text-[10px] font-bold text-brand-700 dark:text-sky-300">
              Matrix
            </span>
          </button>
        </div>

        {activeView === "bonuses" && canWrite ? (
          <div className="flex items-center gap-2">
            {canRead ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTool("gratuity")}
                className="rounded-xl border-sky-200 text-xs font-semibold text-[#0a3271] hover:bg-sky-50 dark:border-sky-800"
              >
                <Award className="mr-1.5 h-3.5 w-3.5" />
                Gratuity Calculator
              </Button>
            ) : null}

            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-xs"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Bonus
            </Button>
          </div>
        ) : null}
      </div>

      {/* Mode 2: Yearly Bonus Matrix (Reference Images View) */}
      {activeView === "matrix" ? (
        <YearlyBonusMatrix />
      ) : (
        /* Mode 1: Bonuses & Approval Queue (Operational View) */
        <div className="flex flex-col gap-5">
          {/* 4 Interactive Metric KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total Bonuses */}
            <button
              type="button"
              onClick={() => {
                handleClearFilters();
              }}
              className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
                status === "" && !hasFilters
                  ? "border-2 border-brand-500 bg-sky-50/50 shadow-md ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
                  : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                    Total Bonuses
                  </p>
                  {status === "" && !hasFilters ? (
                    <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-sky-300">
                      All
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                  {totalCount}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Total value: {money(totalAmount)}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 transition-transform group-hover:scale-105 dark:border-slate-700 dark:bg-slate-800">
                <Coins className="h-5 w-5" />
              </div>
            </button>

            {/* Pending Approvals */}
            <button
              type="button"
              onClick={() => {
                setStatus((prev) => (prev === "PENDING" ? "" : "PENDING"));
                setPage(1);
              }}
              className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
                status === "PENDING"
                  ? "border-2 border-amber-500 bg-amber-50/60 shadow-md ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-950/30"
                  : "border border-amber-200/90 bg-white shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Pending Approval
                  </p>
                  {status === "PENDING" ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                      Active Filter
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {pendingCount}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Awaiting review: {money(pendingAmount)}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:border-amber-900 dark:bg-amber-950/40">
                <Clock className="h-5 w-5" />
              </div>
            </button>

            {/* Approved & Scheduled */}
            <button
              type="button"
              onClick={() => {
                setStatus((prev) => (prev === "APPROVED" ? "" : "APPROVED"));
                setPage(1);
              }}
              className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
                status === "APPROVED"
                  ? "border-2 border-brand-500 bg-sky-50/60 shadow-md ring-2 ring-brand-500/20 dark:border-sky-400 dark:bg-sky-950/30"
                  : "border border-sky-200/90 bg-white shadow-2xs hover:border-brand-400 hover:shadow-md dark:border-sky-900/60 dark:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-sky-300">
                    Approved
                  </p>
                  {status === "APPROVED" ? (
                    <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:text-sky-300">
                      Active Filter
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-400">
                  {approvedCount}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Ready for next payroll run
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-600 transition-transform group-hover:scale-105 dark:border-sky-900 dark:bg-sky-950/40">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </button>

            {/* Paid & Disbursed */}
            <button
              type="button"
              onClick={() => {
                setStatus((prev) => (prev === "PAID" ? "" : "PAID"));
                setPage(1);
              }}
              className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
                status === "PAID"
                  ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
                  : "border border-emerald-200/90 bg-white shadow-2xs hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Paid / Disbursed
                  </p>
                  {status === "PAID" ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                      Active Filter
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {paidCount}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Settled in finalized payslips
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:border-emerald-900 dark:bg-emerald-950/40">
                <Wallet className="h-5 w-5" />
              </div>
            </button>
          </div>

          {/* Unified Horizontal Filter Toolbar */}
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search name, code, reason..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 pr-8 h-10"
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

                {/* Status Filter */}
                <Select
                  aria-label="Filter by bonus status"
                  className="w-full sm:w-40 h-10"
                  value={status}
                  onChange={(e) => {
                    setStatus(
                      e.target.value as
                        (typeof BONUS_FILTER_STATUSES)[number] | "PAID" | "",
                    );
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {BONUS_FILTER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "PENDING"
                        ? "Pending"
                        : s === "APPROVED"
                          ? "Approved"
                          : "Rejected"}
                    </option>
                  ))}
                  <option value="PAID">Paid</option>
                </Select>

                {/* Bonus Type Filter */}
                <Select
                  aria-label="Filter by bonus type"
                  className="w-full sm:w-44 h-10"
                  value={bonusType}
                  onChange={(e) => {
                    setBonusType(e.target.value as BonusType | "");
                    setPage(1);
                  }}
                >
                  <option value="">All bonus types</option>
                  {BONUS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>

                {/* Period Filter */}
                <div className="w-full sm:w-44">
                  <PeriodFilterSelect
                    value={periodId}
                    onChange={(id) => {
                      setPeriodId(id);
                      setPage(1);
                    }}
                  />
                </div>

                {/* Reset Filters Button */}
                {hasFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-xs text-slate-500 hover:text-brand-600 h-10"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Query State Status */}
          <QueryState query={query} area="bonuses" />

          {/* Empty State */}
          {query.isSuccess && rows.length === 0 ? (
            <Card>
              <EmptyState
                title="No bonuses found"
                description={
                  hasFilters
                    ? "No bonuses match your active search or filter criteria. Try resetting filters."
                    : "No bonuses have been recorded yet."
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
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create Bonus
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : null}

          {/* Rich Bonus Cards List */}
          {query.isSuccess && rows.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {rows.map((bonus) => (
                <BonusCard
                  key={bonus.id}
                  bonus={bonus}
                  mayDecide={mayDecide(bonus)}
                  canApprove={canApprove}
                  onApprove={(b) =>
                    setDeciding({ bonus: b, decision: "APPROVED" })
                  }
                  onReject={(b) =>
                    setDeciding({ bonus: b, decision: "REJECTED" })
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
        </div>
      )}

      {/* Modals & Dialogs */}
      {creating ? <NewBonusDialog onClose={() => setCreating(false)} /> : null}
      {tool === "statutory" ? (
        <StatutoryBonusDialog onClose={() => setTool(null)} />
      ) : null}
      {tool === "gratuity" ? (
        <GratuityDialog onClose={() => setTool(null)} />
      ) : null}
      {deciding ? (
        <DecideBonusDialog
          bonus={deciding.bonus}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </div>
  );
}
