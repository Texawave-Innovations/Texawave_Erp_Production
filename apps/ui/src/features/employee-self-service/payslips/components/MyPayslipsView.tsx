"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Select,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { Download, Eye, FileText, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useMyPayslips } from "@/features/hr/payroll/hooks";
import { MY_PAYSLIP_READ } from "@/features/hr/payroll/permissions";
import { money } from "@/features/hr/payroll/format";
import type { Payslip } from "@/features/hr/payroll/types";
import { DownloadPdfButton } from "@/features/hr/payroll/components/PayslipsPanel";
import { PayslipDocumentDialog } from "@/features/hr/payroll/components/PayslipDocumentDialog";

// Legacy MyPayslips.tsx: the recent months always get a card (a greyed,
// dashed placeholder until that month's payslip exists).
const RECENT_MONTHS_TO_SHOW = 6;

interface MonthRow {
  key: string;
  year: number;
  month: number;
  payslip: Payslip | undefined;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The employee's payslips, laid out like the legacy page (TexaWave_ERP_old
 * src/modules/employee/MyPayslips.tsx): "My Payslips" header with a year
 * filter, then one card per month — the last six months always, plus any
 * month that has a payslip — with Download (and View, which this ERP adds
 * since its payslip has an on-screen document).
 */
export function MyPayslipsView() {
  const canRead = usePermission(MY_PAYSLIP_READ);
  const query = useMyPayslips({ page: 1, limit: 100 }, canRead);
  // null = the newest year on file (normally the current year, as legacy).
  const [pickedYear, setSelectedYear] = useState<string | null>(null);
  const [open, setOpen] = useState<Payslip | null>(null);

  const rows = useMemo<MonthRow[]>(() => {
    const byMonth = new Map<string, MonthRow>();
    const now = new Date();
    for (let i = 0; i < RECENT_MONTHS_TO_SHOW; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      byMonth.set(monthKey(y, m), {
        key: monthKey(y, m),
        year: y,
        month: m,
        payslip: undefined,
      });
    }
    // Newest version first, so the latest regeneration wins a month.
    const payslips = [...(query.data?.data ?? [])].sort(
      (a, b) => (b.version ?? 1) - (a.version ?? 1),
    );
    for (const p of payslips) {
      const { year, month } = p.payrollPeriod;
      const key = monthKey(year, month);
      const existing = byMonth.get(key);
      if (existing?.payslip) continue;
      byMonth.set(key, { key, year, month, payslip: p });
    }
    return [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [query.data]);

  const years = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear())]);
    for (const r of rows) set.add(String(r.year));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const selectedYear = pickedYear ?? years[0] ?? "all";
  const filtered =
    selectedYear === "all"
      ? rows
      : rows.filter((r) => String(r.year) === selectedYear);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to payslips">
        Ask an administrator for the{" "}
        <code>employee_self_service.payslip.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-brand-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Payslips
          </h1>
        </div>
        <div className="w-full sm:w-48">
          <Select
            aria-label="Select Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError &&
        query.error.errorCode === "NOT_AN_EMPLOYEE" ? (
          <Alert variant="warning" title="No employee record">
            Payslips are issued to employees only.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <FileText
            className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600"
            aria-hidden="true"
          />
          <p className="font-medium text-gray-500">No Payslips Available</p>
          <p className="mt-1 text-sm text-gray-500">
            There are no payslips available for the selected period.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const p = row.payslip;
            return (
              <Card
                key={row.key}
                className={`flex h-full flex-col justify-between space-y-4 transition-all ${
                  p
                    ? "hover:shadow-md"
                    : "border border-dashed border-gray-300 bg-gray-50/60 opacity-60 dark:border-gray-700 dark:bg-gray-900/40"
                }`}
              >
                <div>
                  <h2 className="text-lg font-semibold leading-tight text-gray-900 dark:text-white">
                    {monthLabel(row.year, row.month)}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{p ? p.payslipNumber : "Payslip"}</span>
                  </div>
                  {p ? (
                    <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {money(p.netPayable)}
                      <span className="ml-1 text-[10px] font-medium text-gray-500">
                        net pay
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2 pt-2">
                  {p ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        aria-label={`View payslip ${p.payslipNumber}`}
                        onClick={() => setOpen(p)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View
                      </Button>
                      <DownloadPdfButton payslip={p} selfService />
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="w-full"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download Payslip
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {open ? (
        <PayslipDocumentDialog
          payslip={open}
          selfService
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
