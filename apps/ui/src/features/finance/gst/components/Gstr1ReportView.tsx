"use client";

import { useMemo } from "react";
import { Alert, EmptyState, ErrorState } from "@texawave-erp/ui-kit";
import {
  Building,
  FileSpreadsheet,
  Info,
  RefreshCw,
  Users,
} from "lucide-react";
import { formatMoney } from "../../shared/format";
import { useGstr1Summary } from "../hooks";

export interface Gstr1ReportViewProps {
  period: string;
}

export function Gstr1ReportView({ period }: Gstr1ReportViewProps) {
  const { data: report, isLoading, isError, error } = useGstr1Summary(period);

  const rateBucketsSorted = useMemo(() => {
    if (!report?.rateBuckets) return [];
    return [...report.rateBuckets].sort((a, b) => a.rate - b.rate);
  }, [report]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 dark:bg-gray-900 dark:border-gray-800">
        <RefreshCw className="h-8 w-8 text-[#1769F5] animate-spin" />
        <span className="mt-3 text-theme-sm text-gray-500 dark:text-gray-400">
          Generating GSTR-1 Outward Return Summary for {period}...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load GSTR-1 Report"
        description={
          (error as Error)?.message ||
          "An error occurred while compiling GSTR-1 outward supply figures."
        }
      />
    );
  }

  if (!report || report.totalInvoices === 0) {
    return (
      <div className="flex flex-col gap-4">
        {report && report.proformaExcludedCount > 0 && (
          <Alert variant="info" title="Statutory Proforma Invoices Exclusion">
            {report.proformaExcludedCount} proforma invoice
            {report.proformaExcludedCount > 1 ? "s were" : " was"} excluded from
            official GSTR-1 tax calculations in compliance with Indian GST
            statutory rules.
          </Alert>
        )}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title={`No Outward Supplies for Period ${period}`}
            description="There are no active sales invoices or outward GST tax entries recorded for this tax period."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* Notice regarding Proforma Invoices */}
      {report.proformaExcludedCount > 0 && (
        <Alert variant="info" title="Statutory Proforma Invoices Exclusion">
          {report.proformaExcludedCount} proforma invoice
          {report.proformaExcludedCount > 1 ? "s were" : " was"} excluded from
          official GSTR-1 tax calculations in compliance with Indian GST
          statutory rules (proforma quotes do not constitute taxable supplies).
        </Alert>
      )}

      {/* B2B vs B2C Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* B2B Supplies Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-blue-200/70 bg-linear-to-br from-blue-50/60 via-white to-sky-50/30 p-5 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-gray-900 dark:to-sky-950/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-bold tracking-wider text-blue-700 uppercase dark:text-sky-400">
              Table 4: B2B Invoices (Registered)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-sky-300">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatMoney(report.b2b.taxableAmount)}
            </span>
            <div className="mt-1 flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
              <span>Total Tax: {formatMoney(report.b2b.totalTaxAmount)}</span>
              <span className="font-semibold text-blue-600 dark:text-sky-400">
                {report.b2b.invoiceCount} invoices
              </span>
            </div>
          </div>
        </div>

        {/* B2C Supplies Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-200/70 bg-linear-to-br from-sky-50/60 via-white to-blue-50/30 p-5 dark:border-sky-900/40 dark:from-sky-950/20 dark:via-gray-900 dark:to-blue-950/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-bold tracking-wider text-sky-700 uppercase dark:text-sky-400">
              Table 7: B2C Invoices (Consumers)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatMoney(report.b2c.taxableAmount)}
            </span>
            <div className="mt-1 flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
              <span>Total Tax: {formatMoney(report.b2c.totalTaxAmount)}</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                {report.b2c.invoiceCount} invoices
              </span>
            </div>
          </div>
        </div>

        {/* Total Aggregate Outward Supplies */}
        <div className="flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Total Outward Liability
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#1769F5] dark:text-sky-400">
              {formatMoney(report.totalTaxAmount)}
            </span>
            <div className="mt-1 flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
              <span>
                Total Taxable: {formatMoney(report.totalTaxableAmount)}
              </span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {report.totalInvoices} total invoices
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Slab Breakdown Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Outward Supplies by Rate Slab (GSTR-1 Section 12 / Rate Matrix)
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Breakdown of taxable supplies, CGST, SGST, and IGST by statutory
              tax rate slabs.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-theme-sm">
            <thead>
              <tr className="border-b border-gray-200/80 dark:border-gray-800 text-theme-xs font-bold text-gray-500 uppercase dark:text-gray-400">
                <th className="py-3 px-4">Rate Slab</th>
                <th className="py-3 px-4 text-right">Taxable Value</th>
                <th className="py-3 px-4 text-right">CGST</th>
                <th className="py-3 px-4 text-right">SGST</th>
                <th className="py-3 px-4 text-right">IGST</th>
                <th className="py-3 px-4 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rateBucketsSorted.map((bucket) => (
                <tr
                  key={bucket.rate}
                  className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                    <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-theme-xs font-bold text-[#1769F5] border border-blue-200/60 dark:bg-blue-950/50 dark:border-blue-900/50 dark:text-sky-300">
                      {bucket.rate}% GST
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-800 dark:text-gray-200">
                    {formatMoney(bucket.taxableAmount)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                    {formatMoney(bucket.cgstAmount)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                    {formatMoney(bucket.sgstAmount)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                    {formatMoney(bucket.igstAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                    {formatMoney(bucket.totalTaxAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 font-bold text-gray-900 dark:text-white">
                <td className="py-3.5 px-4 uppercase text-theme-xs tracking-wider">
                  Total
                </td>
                <td className="py-3.5 px-4 text-right">
                  {formatMoney(report.totalTaxableAmount)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {formatMoney(report.totalCgstAmount)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {formatMoney(report.totalSgstAmount)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {formatMoney(report.totalIgstAmount)}
                </td>
                <td className="py-3.5 px-4 text-right text-[#1769F5] dark:text-sky-400 text-base">
                  {formatMoney(report.totalTaxAmount)}
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
          Statutory Notice: Figures shown are aggregated from internal ERP sales
          invoices for return preparation. Official tax compliance is finalized
          upon return verification and submission on the GST Common Portal.
        </span>
      </div>
    </div>
  );
}
