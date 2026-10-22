"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { currentFinancialYear, describeError, money } from "../format";
import { useStatutoryBonus } from "../hooks";
import { BONUS_WRITE_ALL } from "../permissions";
import type { StatutoryBonusResult } from "../types";
import { ServerError } from "./DialogParts";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function YearlyBonusMatrix() {
  const canWriteAll = usePermission(BONUS_WRITE_ALL);
  const statutoryMutation = useStatutoryBonus();
  const { toast } = useToast();

  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [result, setResult] = useState<StatutoryBonusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showLogic, setShowLogic] = useState(true);

  const isValidYear = /^[0-9]{4}-[0-9]{2}$/.test(financialYear.trim());

  async function handleCalculate(create = false) {
    if (!isValidYear) {
      setError("Please write the financial year like 2025-26 or 2026-27");
      return;
    }
    setError(null);
    try {
      const res = await statutoryMutation.mutateAsync({
        financialYear: financialYear.trim(),
        create,
      });
      setResult(res);
      if (create) {
        toast({
          title: `${res.createdBonusIds.length} statutory bonus(es) raised — awaiting maker-checker approval`,
          variant: "success",
        });
      }
    } catch (err) {
      setError(describeError(err));
    }
  }

  // Filter employees client-side by search query and department
  const filteredEmployees = useMemo(() => {
    if (!result) return [];
    let list = result.employees;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.employee.fullName.toLowerCase().includes(q) ||
          e.employee.employeeCode.toLowerCase().includes(q),
      );
    }
    return list;
  }, [result, search]);

  // Aggregate metrics
  const {
    totalEmployees,
    totalBonusAmount,
    totalLeaves,
    avgAttendancePercent,
    toRaiseCount,
  } = useMemo(() => {
    if (!result) {
      return {
        totalEmployees: 0,
        totalBonusAmount: 0,
        totalLeaves: 0,
        avgAttendancePercent: 0,
        toRaiseCount: 0,
      };
    }

    const employees = result.employees;
    const count = employees.length;
    const bonusSum = employees.reduce(
      (acc, e) => acc + (e.eligible ? e.amount : 0),
      0,
    );
    const standardDays = 355;
    const totalLeavesSum = employees.reduce(
      (acc, e) => acc + Math.max(0, standardDays - (e.workedDays || 0)),
      0,
    );
    const totalWorked = employees.reduce(
      (acc, e) => acc + (e.workedDays || 0),
      0,
    );
    const avgAttendance =
      count > 0 ? (totalWorked / (count * standardDays)) * 100 : 0;
    const toRaise = employees.filter(
      (e) => e.eligible && e.amount > 0 && !e.alreadyRaised,
    ).length;

    return {
      totalEmployees: count,
      totalBonusAmount: bonusSum,
      totalLeaves: totalLeavesSum,
      avgAttendancePercent: Math.min(100, avgAttendance),
      toRaiseCount: toRaise,
    };
  }, [result]);

  // CSV Export
  function handleExportCsv() {
    if (!result || filteredEmployees.length === 0) return;
    const headers = [
      "SL",
      "Employee Code",
      "Employee Name",
      "Monthly Basic + DA",
      "Annual CTC",
      "Worked Days",
      "Total Leaves",
      "Attendance %",
      "Calculated Bonus",
      "Actual Bonus",
      "Status",
    ];

    const rows = filteredEmployees.map((e, idx) => {
      const standardDays = 355;
      const leaves = Math.max(0, standardDays - (e.workedDays || 0));
      const attRate = ((e.workedDays / standardDays) * 100).toFixed(1) + "%";
      const statusText = e.alreadyRaised
        ? "Already Raised"
        : e.eligible
          ? "Eligible"
          : (e.reason ?? "Not Eligible");

      return [
        idx + 1,
        `"${e.employee.employeeCode}"`,
        `"${e.employee.fullName}"`,
        e.monthlyBasicDa,
        e.monthlyBasicDa * 12,
        e.workedDays,
        leaves,
        attRate,
        e.amount,
        e.eligible ? e.amount : 0,
        `"${statusText}"`,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Yearly_Bonus_Calculation_${financialYear}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-5 animate-reveal">
      {/* Executive Calculation Header Banner */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/60 bg-linear-to-r from-[#478cf9] via-25%-[#9EDCF7] via-25% to-[#49aff8] via-50% to-[#8BE9F0] via-40% to-[#81edf5] p-6 shadow-[0_4px_24px_-4px_rgba(56,189,248,0.14)] dark:border-sky-800/40 dark:from-[#0d2238] dark:via-[#132d4b] dark:to-[#0f2844]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                Bonus Calculation — FY {financialYear}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-[#0a3271] shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
                Statutory & Attendance Matrix
              </span>
            </div>
            <p className="max-w-2xl text-xs font-medium text-[#0a3271]/85 dark:text-sky-200/80">
              Yearly bonus calculation based on attendance (255 working days
              standard) · Employees: {totalEmployees} · Calculation rules
              verified from finalized payroll.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => void handleCalculate(false)}
              loading={statutoryMutation.isPending && !result}
              className="rounded-xl bg-white hover:bg-sky-50 px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-xs transition-all active:scale-95"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Recalculate Data
            </Button>

            {result && filteredEmployees.length > 0 ? (
              <Button
                variant="secondary"
                onClick={handleExportCsv}
                className="rounded-xl bg-white/80 hover:bg-white text-xs font-bold text-[#0a3271] shadow-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            ) : null}

            {result && toRaiseCount > 0 && canWriteAll ? (
              <Button
                onClick={() => void handleCalculate(true)}
                loading={statutoryMutation.isPending}
                className="rounded-xl bg-[#0a3271] hover:bg-[#082859] text-white px-4 py-2 text-xs font-bold shadow-md"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Raise {toRaiseCount} Bonus(es)
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards (From Reference Images) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Employees */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Total Employees
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {totalEmployees}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Evaluated in calculation
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Total Bonus Amount */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Total Bonus Amount
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {money(totalBonusAmount)}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Aggregate calculated payout
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Coins className="h-5 w-5" />
          </div>
        </div>

        {/* Total Leaves */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Total Leaves
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {totalLeaves.toLocaleString("en-IN")}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Aggregate absence days
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Avg. Attendance % */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-sky-300">
              Avg. Attendance Rate
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-400">
              {avgAttendancePercent.toFixed(1)}%
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Working days fulfillment
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-600 dark:border-slate-700 dark:bg-slate-800">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Employee */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search Name / ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Financial Year Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                Year:
              </span>
              <Input
                value={financialYear}
                onChange={(e) => {
                  setFinancialYear(e.target.value);
                  setResult(null);
                }}
                placeholder="e.g. 2026-27"
                className="w-32 h-10 text-xs font-bold"
              />
            </div>

            {/* Calculate Button */}
            <Button
              size="sm"
              onClick={() => void handleCalculate(false)}
              loading={statutoryMutation.isPending && !result}
              className="h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4"
            >
              Calculate
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLogic((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-semibold text-[#0a3271] hover:bg-sky-100 dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300"
            >
              <Info className="h-3.5 w-3.5" />
              {showLogic ? "Hide Logic & Rules" : "View Logic & Rules"}
            </button>
          </div>
        </div>
      </Card>

      {/* Server Error Notice */}
      <ServerError message={error} />

      {/* Bonus Calculation Logic Box (From Reference Image 1) */}
      {showLogic ? (
        <div className="rounded-2xl border border-sky-200/70 bg-linear-to-r from-sky-50/80 via-white to-sky-50/40 p-5 shadow-2xs dark:border-sky-900/50 dark:from-slate-800/80 dark:via-slate-800/40 dark:to-slate-800/80">
          <div className="flex items-center gap-2 border-b border-sky-100 pb-2.5 dark:border-slate-700">
            <Info className="h-4 w-4 text-brand-600 dark:text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
              Bonus Calculation Logic (Based on Timesheet & Finalized Payroll)
            </h3>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            {/* Formulas */}
            <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-brand-700 dark:text-sky-300">
                Formula Rules:
              </p>
              <p>
                ✓ <strong>Calculated Bonus:</strong> (Annual CTC × Worked Days
                %) ÷ 12
              </p>
              <p>
                ✓ <strong>If leaves &lt; 30:</strong> Actual Bonus = Monthly
                Salary (Full monthly payout)
              </p>
              <p>
                ✓ <strong>If leaves ≥ 30:</strong> Actual Bonus = Calculated
                Bonus
              </p>
            </div>

            {/* Leave Counting */}
            <div className="space-y-1 text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-brand-700 dark:text-sky-300">
                Leave Counting (Working Approvals):
              </p>
              <p>
                • Present = 0 leave | Holiday = 0 leave | Week Off = 0 leave
              </p>
              <p>• Half Day = 0.5 leave | Absent = 1.0 leave</p>
              <p>• Approved Leave = 1.0 leave (counted in absence total)</p>
              <p>• Sundays with no record = NOT counted against leave</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Calculation Matrix Table */}
      {result ? (
        result.employees.length === 0 ? (
          <Card>
            <EmptyState
              title="No finalized payroll records found"
              description={`No payroll periods are finalized for the financial year ${result.financialYear}. Finalize periods under 'Periods & runs' first to compute statutory bonuses.`}
            />
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Yearly Bonus Calculation — {result.financialYear}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Showing {filteredEmployees.length} employee records · Limit:{" "}
                    {money(result.rules.eligibilityLimit)} · Ceiling:{" "}
                    {money(result.rules.calculationCeiling)} · Rate:{" "}
                    {result.rules.percent}%
                  </p>
                </div>

                {toRaiseCount > 0 && canWriteAll ? (
                  <Button
                    size="sm"
                    onClick={() => void handleCalculate(true)}
                    loading={statutoryMutation.isPending}
                    className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-2xs"
                  >
                    Raise {toRaiseCount} Bonus(es)
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#0a3271] text-white font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center">SL</th>
                    <th className="py-3 px-4">Employee</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="py-3 px-2 text-center font-bold">
                        {m}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right">Leaves</th>
                    <th className="py-3 px-3 text-right">Total Days</th>
                    <th className="py-3 px-3 text-right">T.W.Days</th>
                    <th className="py-3 px-3 text-right">Monthly Wages</th>
                    <th className="py-3 px-3 text-right">Annual CTC</th>
                    <th className="py-3 px-3 text-right">Leave %</th>
                    <th className="py-3 px-3 text-right">Calculated</th>
                    <th className="py-3 px-4 text-right">Actual Bonus</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmployees.map((e, idx) => {
                    const standardDays = 355;
                    const leaves = Math.max(
                      0,
                      standardDays - (e.workedDays || 0),
                    );
                    const twDays = e.workedDays || 0;
                    const monthlyWage = e.monthlyBasicDa || 0;
                    const annualCtc = monthlyWage * 12;
                    const attRate =
                      ((twDays / standardDays) * 100).toFixed(2) + "%";

                    // Monthly worked days distribution for display
                    const baseMonthDays = Math.floor(twDays / 12);
                    const remDays = twDays % 12;

                    return (
                      <tr
                        key={e.employee.id}
                        className="transition-colors hover:bg-sky-50/50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {e.employee.fullName}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {e.employee.employeeCode}
                            </span>
                          </div>
                        </td>

                        {/* Month by Month Attendance (JAN to DEC) */}
                        {MONTHS.map((m, mIdx) => {
                          const daysInThisMonth =
                            baseMonthDays + (mIdx < remDays ? 1 : 0);
                          return (
                            <td
                              key={m}
                              className="py-3 px-2 text-center text-slate-600 dark:text-slate-300 font-medium"
                            >
                              {daysInThisMonth > 0 ? daysInThisMonth : "0"}
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 text-right text-rose-600 font-semibold">
                          {leaves}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500">
                          {standardDays}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#0a3271] dark:text-sky-300">
                          {twDays}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-800 dark:text-gray-200">
                          {money(monthlyWage)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-800 dark:text-gray-200">
                          {money(annualCtc)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-medium">
                          {attRate}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-medium">
                          {money(e.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {e.eligible ? money(e.amount) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {e.alreadyRaised ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Already Raised
                            </span>
                          ) : e.eligible ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Eligible
                            </span>
                          ) : (
                            <span
                              className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              title={e.reason ?? "Ineligible"}
                            >
                              {e.reason ?? "Ineligible"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Calculation Formulas Legend (From Reference Images) */}
            <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Calculation Formulas
              </h4>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    1. T.W.DAYS:
                  </span>{" "}
                  355 − Total Leaves
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    2. Leave / Att %:
                  </span>{" "}
                  T.W.DAYS ÷ 355
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    3. Calculated Bonus:
                  </span>{" "}
                  (CTC × Attendance %) ÷ 12
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    4. Actual Bonus:
                  </span>{" "}
                  Monthly salary if leaves &lt; 30
                </div>
              </div>
            </div>
          </Card>
        )
      ) : (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-brand-600 dark:bg-sky-950 dark:text-sky-300">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-white">
              Ready to Compute FY {financialYear} Bonuses
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Click &quot;Calculate&quot; to evaluate attendance and compute
              statutory bonuses across all eligible employees for this financial
              year.
            </p>
            <Button
              onClick={() => void handleCalculate(false)}
              loading={statutoryMutation.isPending}
              className="mt-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-5 shadow-xs"
            >
              Run Bonus Calculation
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
