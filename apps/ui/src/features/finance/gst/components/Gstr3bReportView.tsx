"use client";

import { EmptyState, ErrorState } from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  RefreshCw,
  Scale,
} from "lucide-react";
import { formatMoney } from "../../shared/format";
import { useGstr3bSummary } from "../hooks";

export interface Gstr3bReportViewProps {
  period: string;
}

export function Gstr3bReportView({ period }: Gstr3bReportViewProps) {
  const { data: report, isLoading, isError, error } = useGstr3bSummary(period);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 dark:bg-gray-900 dark:border-gray-800">
        <RefreshCw className="h-8 w-8 text-[#1769F5] animate-spin" />
        <span className="mt-3 text-theme-sm text-gray-500 dark:text-gray-400">
          Compiling GSTR-3B Monthly Return Netting for {period}...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load GSTR-3B Return"
        description={
          (error as Error)?.message ||
          "An error occurred while compiling GSTR-3B monthly tax netting data."
        }
      />
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <EmptyState
          title={`No GSTR-3B Data for Period ${period}`}
          description="There are no outward or inward tax transactions recorded for this period."
        />
      </div>
    );
  }

  const outward = report.outwardTaxableSupplies;
  const itc = report.eligibleItc;
  const net = report.netTaxPayable;

  const rows = [
    {
      label: "Integrated Tax (IGST)",
      outward: outward.igstAmount,
      itc: itc.igstAmount,
      net: net.igstAmount,
    },
    {
      label: "Central Tax (CGST)",
      outward: outward.cgstAmount,
      itc: itc.cgstAmount,
      net: net.cgstAmount,
    },
    {
      label: "State/UT Tax (SGST)",
      outward: outward.sgstAmount,
      itc: itc.sgstAmount,
      net: net.sgstAmount,
    },
  ];

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* Return Summary Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-blue-200/80 bg-linear-to-r from-blue-50/80 via-white to-sky-50/40 p-6 dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20 shadow-xs">
        <div>
          <span className="text-theme-xs font-bold tracking-wider text-blue-700 uppercase dark:text-sky-400">
            Monthly Summary Return — Form GSTR-3B
          </span>
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
            Tax Period: {period}
          </h3>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            Auto-netted against eligible Input Tax Credit (ITC) per Section 49
            of the CGST Act.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 shadow-xs self-start sm:self-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1769F5] text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Total Net Tax Payable
            </span>
            <div className="text-2xl font-extrabold text-[#1769F5] dark:text-sky-400">
              {formatMoney(net.totalTaxAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3.1 & Section 4 Comparison Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Table 3.1: Details of Outward Supplies */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="text-theme-xs font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
                Table 3.1
              </span>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                Outward Taxable Supplies (Liability)
              </h4>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-sky-300">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Total Taxable Value
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatMoney(outward.taxableAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Integrated Tax (IGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(outward.igstAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Central Tax (CGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(outward.cgstAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                State/UT Tax (SGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(outward.sgstAmount)}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center font-bold">
              <span className="text-gray-900 dark:text-white">
                Total Outward Tax
              </span>
              <span className="text-base text-blue-600 dark:text-sky-400">
                {formatMoney(outward.totalTaxAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Table 4: Eligible ITC */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="text-theme-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                Table 4
              </span>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                Eligible Input Tax Credit (ITC)
              </h4>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Inward Taxable Value
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatMoney(itc.taxableAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Integrated Tax (IGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(itc.igstAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Central Tax (CGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(itc.cgstAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-theme-sm">
              <span className="text-gray-500 dark:text-gray-400">
                State/UT Tax (SGST)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {formatMoney(itc.sgstAmount)}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center font-bold">
              <span className="text-gray-900 dark:text-white">
                Total Eligible ITC
              </span>
              <span className="text-base text-sky-600 dark:text-sky-400">
                {formatMoney(itc.totalTaxAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table 5: Net Tax Payable Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="mb-4">
          <h4 className="text-base font-bold text-gray-900 dark:text-white">
            Table 5: Net Tax Payable / Set-Off Matrix
          </h4>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Net liability payable in cash after setting off eligible Input Tax
            Credit against outward tax dues.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-theme-sm">
            <thead>
              <tr className="border-b border-gray-200/80 dark:border-gray-800 text-theme-xs font-bold text-gray-500 uppercase dark:text-gray-400">
                <th className="py-3 px-4">Tax Head Description</th>
                <th className="py-3 px-4 text-right">Outward Tax Dues</th>
                <th className="py-3 px-4 text-right">Eligible ITC Set-Off</th>
                <th className="py-3 px-4 text-right">Net Tax Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                    {row.label}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-700 dark:text-gray-300">
                    {formatMoney(row.outward)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-sky-600 dark:text-sky-400">
                    {formatMoney(row.itc)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold">
                    <span
                      className={
                        row.net > 0
                          ? "text-[#1769F5] dark:text-sky-300"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatMoney(row.net)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 font-bold text-gray-900 dark:text-white">
                <td className="py-3.5 px-4 uppercase text-theme-xs tracking-wider">
                  Total Net Payable
                </td>
                <td className="py-3.5 px-4 text-right">
                  {formatMoney(outward.totalTaxAmount)}
                </td>
                <td className="py-3.5 px-4 text-right text-sky-700 dark:text-sky-300">
                  {formatMoney(itc.totalTaxAmount)}
                </td>
                <td className="py-3.5 px-4 text-right text-[#1769F5] dark:text-sky-400 text-base">
                  {formatMoney(net.totalTaxAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Statutory Disclaimer Footer */}
      <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3.5 text-theme-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 border border-gray-200/60 dark:border-gray-800">
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <span>
          Statutory Notice: Form GSTR-3B monthly return values are compiled from
          ERP transaction records and do not claim official tax filing discharge
          until approved and paid on the GST Portal.
        </span>
      </div>
    </div>
  );
}
