"use client";

import { useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Printer,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Button, Dialog, useToast } from "@texawave-erp/ui-kit";
import { downloadPayslipPdf } from "../api";
import { downloadBlob } from "../download";
import { days, describeError, isoDate, money, periodLabel } from "../format";
import type { Payslip } from "../types";
import { numberToWords } from "@/features/crm/quotations/print/numberToWords";

const SOURCE_LABEL: Record<string, string> = {
  PF: "Provident Fund",
  ESI: "Employee State Insurance",
  LOAN: "Company Loan EMI",
};

export function PayslipDocumentDialog({
  payslip: p,
  selfService,
  onClose,
}: {
  payslip: Payslip;
  selfService: boolean;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const bank = p.employee.bankDetails;
  const netAmount = Number(p.netPayable) || 0;
  const netInWords = useMemo(() => numberToWords(netAmount), [netAmount]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const pdf = await downloadPayslipPdf(p.id, selfService);
      downloadBlob(`${p.payslipNumber}.pdf`, pdf);
      toast({
        title: "Payslip downloaded successfully",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Could not download the payslip PDF",
        description: describeError(err),
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      showHeader={false}
      size="4xl"
      contentClassName="p-0 flex flex-col min-h-0"
    >
      {/* Top Action Bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-sky-100 bg-sky-50/60 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/60 rounded-t-2xl print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-600 dark:text-sky-400" />
          <span className="font-bold text-sm text-[#0a3271] dark:text-white">
            Payslip Preview · {p.payslipNumber}
          </span>
          {p.version && p.version > 1 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              v{p.version} (Regenerated)
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePrint}
            className="text-xs font-semibold"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            size="sm"
            loading={downloading}
            onClick={handleDownloadPdf}
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download PDF
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Printable Official Salary Slip Document */}
      <div
        ref={printRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      >
        {/* Company Header */}
        <div className="border-b-2 border-[#0a3271] pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0a3271] dark:text-sky-400">
              TEXAWAVE INNOVATIONS PRIVATE LIMITED
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chennai, Tamil Nadu, India · Corporate Payroll & Employee Services
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-sky-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:bg-slate-800 dark:text-sky-300">
              Salary Pay Advice
            </span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
              {periodLabel(p.payrollPeriod)}
            </p>
          </div>
        </div>

        {/* Regeneration notice if any */}
        {p.regenerationReason ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Audit Note:</strong> Regenerated on{" "}
            {isoDate(p.regeneratedAt)}: {p.regenerationReason}
          </div>
        ) : null}

        {/* Employee & Statutory Metadata Grid */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300 mb-3">
            Employee & Attendance Profile
          </h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 sm:grid-cols-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Employee Name
              </span>
              <strong className="text-slate-900 dark:text-white font-bold">
                {p.employee.fullName}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Employee Code
              </span>
              <strong className="text-slate-900 dark:text-white font-bold">
                {p.employee.employeeCode}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Designation
              </span>
              <span className="font-semibold">
                {p.employee.designation?.name ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Department / Team
              </span>
              <span className="font-semibold">
                {p.employee.department?.name ||
                  p.employee.team?.name ||
                  "General"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Bank Name
              </span>
              <span className="font-medium">{bank?.bankName ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Account Number
              </span>
              <span className="font-medium">{bank?.accountNumber ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                PAN Number
              </span>
              <span className="font-medium">{bank?.panNumber ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                PF UAN
              </span>
              <span className="font-medium">
                {p.employee.pfProfile?.uan ?? "—"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                ESI IP Number
              </span>
              <span className="font-medium">
                {p.employee.esiProfile?.insuranceNumber ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Payable Days
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {days(p.payrollEntry.payableDays)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Loss of Pay (LOP)
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {days(p.payrollEntry.lopDays)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Generated Date
              </span>
              <span className="font-medium">{isoDate(p.generatedAt)}</span>
            </div>
          </div>
        </div>

        {/* 2-Column Earnings vs Deductions Table */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Earnings Breakdown */}
          <div className="rounded-xl border border-sky-100 overflow-hidden dark:border-slate-800">
            <div className="bg-sky-50/80 px-4 py-2.5 border-b border-sky-100 dark:bg-slate-900 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
                Earnings
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
                Amount (₹)
              </span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {p.payrollEntry.earnings.map((e) => (
                  <tr
                    key={e.code}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                      {e.name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                      {money(e.calculatedAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-sky-50/40 dark:border-slate-800 dark:bg-slate-900/60 font-bold">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">
                    Total Gross Earnings
                  </td>
                  <td className="px-4 py-3 text-right text-brand-700 dark:text-sky-300">
                    {money(p.payrollEntry.totalGrossEarnings)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Breakdown */}
          <div className="rounded-xl border border-amber-100 overflow-hidden dark:border-slate-800">
            <div className="bg-amber-50/80 px-4 py-2.5 border-b border-amber-100 dark:bg-slate-900 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Deductions
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Amount (₹)
              </span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {p.payrollEntry.deductions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-4 text-center text-slate-400"
                    >
                      No statutory or company deductions.
                    </td>
                  </tr>
                ) : (
                  p.payrollEntry.deductions.map((d) => (
                    <tr
                      key={d.code}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                        {d.name}
                        {d.sourceType && SOURCE_LABEL[d.sourceType] ? (
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">
                            ({SOURCE_LABEL[d.sourceType]})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {money(d.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-amber-50/40 dark:border-slate-800 dark:bg-slate-900/60 font-bold">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">
                    Total Deductions
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">
                    {money(p.payrollEntry.totalDeductions)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net Take-Home Highlight Banner */}
        <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/60 p-5 dark:border-emerald-600/40 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Net Take-Home Pay (Bank Credit)
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300 italic">
              Amount in words:{" "}
              <span className="font-bold text-emerald-900 dark:text-emerald-200 not-italic">
                {netInWords}
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
              {money(p.netPayable)}
            </span>
          </div>
        </div>

        {/* Disclaimer / Authorization Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
          <p>
            This is a system-generated document and does not require a physical
            signature.
          </p>
          <p>TexaOne ERP Payroll Engine · Confidential</p>
        </div>
      </div>
    </Dialog>
  );
}
