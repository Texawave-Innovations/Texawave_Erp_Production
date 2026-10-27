"use client";

import { useMemo, useState } from "react";
import type {
  FinanceGstEntry,
  FinanceGstEntryType,
  FinanceGstStatus,
  QueryFinanceGstEntriesInput,
} from "@texawave-erp/api-types";
import {
  ActionMenu,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Hash,
  Plus,
  Receipt,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney } from "../../shared/format";
import { useGstEntries } from "../hooks";
import { FINANCE_GST_READ, FINANCE_GST_WRITE } from "../permissions";
import { AddGstEntryDialog } from "./AddGstEntryDialog";
import { GstEntryDetailDialog } from "./GstEntryDetailDialog";
import { GstSummaryCards } from "./GstSummaryCards";
import { Gstr1ReportView } from "./Gstr1ReportView";
import { Gstr3bReportView } from "./Gstr3bReportView";
import { HsnSummaryView } from "./HsnSummaryView";
import { ReconcileGstModal } from "./ReconcileGstModal";

const PAGE_SIZE = 15;

export type GstSubTab =
  "registry" | "gstr1" | "gstr3b" | "hsn" | "reconciliation";

export function GstView() {
  const canRead = usePermission(FINANCE_GST_READ);
  const canWrite = usePermission(FINANCE_GST_WRITE);

  // Period management (default current period 2026-10)
  const [period, setPeriod] = useState("2026-10");

  // Active subtab
  const [activeTab, setActiveTab] = useState<GstSubTab>("registry");

  // Registry table filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [entryTypeFilter, setEntryTypeFilter] = useState<
    FinanceGstEntryType | "ALL"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<FinanceGstStatus | "ALL">(
    "ALL",
  );

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FinanceGstEntry | null>(
    null,
  );

  // Change period helpers
  const handlePrevMonth = () => {
    const [yearStr, monthStr] = period.split("-");
    let y = parseInt(yearStr ?? "2026", 10);
    let m = parseInt(monthStr ?? "10", 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setPeriod(`${y}-${String(m).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = period.split("-");
    let y = parseInt(yearStr ?? "2026", 10);
    let m = parseInt(monthStr ?? "10", 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setPeriod(`${y}-${String(m).padStart(2, "0")}`);
  };

  // Build query params for Tax Ledger Registry
  const queryParams = useMemo<QueryFinanceGstEntriesInput>(() => {
    const q: QueryFinanceGstEntriesInput = {
      page,
      limit: PAGE_SIZE,
      period,
    };
    if (debouncedSearch.trim()) {
      q.search = debouncedSearch.trim();
    }
    if (entryTypeFilter !== "ALL") {
      q.entryType = entryTypeFilter;
    }
    if (statusFilter !== "ALL") {
      q.status = statusFilter;
    }
    return q;
  }, [page, period, debouncedSearch, entryTypeFilter, statusFilter]);

  const entriesQuery = useGstEntries(queryParams);
  const entries = entriesQuery.data?.data ?? [];
  const entriesMeta = entriesQuery.data?.meta;

  const getStatusColorToken = (status: string) => {
    switch (status) {
      case "RECONCILED":
        return "success";
      case "FILED":
        return "brand";
      case "ACTIVE":
        return "brand";
      case "CANCELLED":
        return "error";
      default:
        return "gray";
    }
  };

  const columns: DataTableColumn<FinanceGstEntry>[] = [
    {
      header: "REFERENCE / DOC",
      sortable: true,
      cell: (row) => {
        const isManual = row.sourceType === "MANUAL";
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-theme-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              {row.sourceReference}
            </span>
            <div className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              <span>{row.sourceType}</span>
              {row.isProformaExcluded && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  (Proforma Excluded)
                </span>
              )}
            </div>
            <div className="pt-0.5">
              {isManual ? (
                <span
                  title="Statutory registry entry only — not posted to General Ledger"
                  className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  Registry Only
                </span>
              ) : (
                <span
                  title="Integrated with General Ledger double-entry posting"
                  className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1769F5] border border-blue-200/50 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-800/40"
                >
                  GL Linked
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "COUNTERPARTY GSTIN",
      sortable: true,
      cell: (row) => (
        <span className="text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
          {row.gstin}
        </span>
      ),
    },
    {
      header: "ENTRY TYPE",
      sortable: true,
      cell: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-theme-xs font-bold ${
            row.entryType === "OUTPUT_GST"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-sky-300 border border-blue-200/50"
              : "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-200/50"
          }`}
        >
          {row.entryType === "OUTPUT_GST" ? (
            <>
              <ArrowUpRight className="h-3 w-3 text-blue-600" />
              <span>OUTPUT</span>
            </>
          ) : (
            <>
              <ArrowDownLeft className="h-3 w-3 text-sky-600" />
              <span>ITC INWARD</span>
            </>
          )}
        </span>
      ),
    },
    {
      header: "HSN/SAC",
      cell: (row) => (
        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
          {row.hsnSacCode || "—"}
        </span>
      ),
    },
    {
      header: "TAXABLE BASE",
      sortable: true,
      cell: (row) => (
        <span className="text-theme-sm font-medium text-gray-900 dark:text-white">
          {formatMoney(row.taxableAmount)}
        </span>
      ),
    },
    {
      header: "TAX BREAKDOWN",
      cell: (row) => {
        const parts: string[] = [];
        if (Number(row.cgstAmount) > 0) parts.push(`C: ₹${row.cgstAmount}`);
        if (Number(row.sgstAmount) > 0) parts.push(`S: ₹${row.sgstAmount}`);
        if (Number(row.igstAmount) > 0) parts.push(`I: ₹${row.igstAmount}`);
        return (
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            {parts.length > 0 ? parts.join(" | ") : "Nil"}
          </span>
        );
      },
    },
    {
      header: "TOTAL TAX",
      sortable: true,
      cell: (row) => (
        <span className="text-theme-sm font-bold text-[#1769F5] dark:text-sky-400">
          {formatMoney(row.totalTaxAmount)}
        </span>
      ),
    },
    {
      header: "STATUS",
      cell: (row) => (
        <StatusBadge
          label={row.status}
          colorToken={getStatusColorToken(row.status)}
        />
      ),
    },
    {
      header: "",
      cell: (row) => (
        <ActionMenu
          ariaLabel={`Actions for entry #${row.id}`}
          items={[
            {
              label: "View Entry Details",
              icon: <Eye className="h-4 w-4" />,
              onClick: () => setSelectedEntry(row),
            },
          ]}
        />
      ),
    },
  ];

  if (!canRead) {
    return (
      <ErrorState
        title="Access Restricted"
        description="You do not have permission to view GST & Tax Compliance data (finance.gst.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* 1. Summary Cards */}
      <GstSummaryCards period={period} />

      {/* 2. Hero Header Banner (TexaOne Prime Blue) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl p-6 shadow-xs text-white bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] dark:from-[#082352] dark:via-[#0e4cb8] dark:to-[#0369a1]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-sky-200" />
            <h2 className="text-2xl font-bold tracking-tight text-white">
              GST Registry & Returns
            </h2>
          </div>
          <p className="text-theme-sm text-sky-100 font-medium">
            Form GSTR-1, Form GSTR-3B netting, statutory tax ledgers, HSN/SAC
            summaries & GSTR-2B ITC reconciliation
          </p>
        </div>

        {/* Period Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Period Controller */}
          <div className="flex items-center rounded-xl bg-white/15 px-2 py-1 border border-white/20 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2.5 text-theme-sm font-bold text-white tracking-wide">
              {period}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setReconcileOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-theme-sm font-bold text-white transition-all shadow-xs cursor-pointer border border-white/20"
              >
                <FileCheck2 className="h-4 w-4 text-sky-200" />
                <span>Reconcile GSTR-2B</span>
              </button>

              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-theme-sm font-bold text-[#1769F5] hover:bg-sky-50 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4 text-[#1769F5]" />
                <span>Record GST Entry</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab("registry")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "registry"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Tax Ledger / Registry</span>
          {entriesMeta && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-theme-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-sky-300">
              {entriesMeta.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gstr1")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "gstr1"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>GSTR-1 (Outward)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gstr3b")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "gstr3b"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>GSTR-3B (Monthly Return)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hsn")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "hsn"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <Hash className="h-4 w-4" />
          <span>HSN / SAC Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "reconciliation"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          <span>ITC Reconciliation</span>
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === "registry" && (
        <div className="flex flex-col gap-4">
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 items-center">
              <div className="w-full md:col-span-6">
                <SearchInput
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  onClear={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  placeholder="Search reference or GSTIN..."
                />
              </div>

              <div className="w-full md:col-span-3 relative focus-within:z-30">
                <Select
                  value={entryTypeFilter}
                  onChange={(e) => {
                    setEntryTypeFilter(
                      e.target.value as FinanceGstEntryType | "ALL",
                    );
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Entry Types</option>
                  <option value="OUTPUT_GST">Output GST (Outward)</option>
                  <option value="INPUT_TAX_CREDIT">
                    Input Tax Credit (ITC)
                  </option>
                </Select>
              </div>

              <div className="w-full md:col-span-3 relative focus-within:z-30">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as FinanceGstStatus | "ALL");
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="FILED">Filed</option>
                  <option value="RECONCILED">Reconciled</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 p-4 relative focus-within:z-30">
            <DataTable
              columns={columns}
              rows={entries}
              getRowKey={(row) => String(row.id)}
              loading={entriesQuery.isLoading}
              emptyState={
                <EmptyState
                  title="No GST Entries Found"
                  description={
                    search ||
                    entryTypeFilter !== "ALL" ||
                    statusFilter !== "ALL"
                      ? "Try adjusting your search criteria or filters."
                      : `No GST tax ledger entries recorded for period ${period}. Click 'Record GST Entry' to create one.`
                  }
                />
              }
            />

            {entriesMeta && entriesMeta.totalPages > 1 && (
              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <Pagination
                  page={page}
                  totalPages={entriesMeta.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "gstr1" && <Gstr1ReportView period={period} />}

      {activeTab === "gstr3b" && <Gstr3bReportView period={period} />}

      {activeTab === "hsn" && <HsnSummaryView period={period} />}

      {activeTab === "reconciliation" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  GSTR-2B vs ERP Books Reconciliation
                </h3>
                <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Reconcile purchase invoices recorded in the ERP against
                  outward supplier invoices filed in Form GSTR-2B.
                </p>
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setReconcileOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1769F5] px-4 py-2.5 text-theme-sm font-bold text-white hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Launch Reconciliation for {period}</span>
                </button>
              )}
            </div>
          </div>
          <Gstr3bReportView period={period} />
        </div>
      )}

      {/* Dialogs */}
      <AddGstEntryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultPeriod={period}
        onSuccess={() => entriesQuery.refetch()}
      />

      <ReconcileGstModal
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        defaultPeriod={period}
        onSuccess={() => entriesQuery.refetch()}
      />

      <GstEntryDetailDialog
        entry={selectedEntry}
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
