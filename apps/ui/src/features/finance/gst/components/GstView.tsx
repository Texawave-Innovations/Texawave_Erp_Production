"use client";

import { useState } from "react";
import { ErrorState } from "@texawave-erp/ui-kit";
import {
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { FINANCE_GST_READ } from "../permissions";
import { HsnSummaryView } from "./HsnSummaryView";
import { GstReconciliationView } from "./GstReconciliationView";

export type GstSubTab = "hsn" | "reconciliation";

export function GstView() {
  const canRead = usePermission(FINANCE_GST_READ);

  // Period management (default current period 2026-10)
  const [period, setPeriod] = useState("2026-10");

  // Primary GST simplified navigation: HSN Summary and GST Reconciliation
  const [activeTab, setActiveTab] = useState<GstSubTab>("hsn");

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
      {/* Hero Header Banner (TexaOne Prime Blue) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl p-6 shadow-xs text-white bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] dark:from-[#082352] dark:via-[#0e4cb8] dark:to-[#0369a1]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-sky-200" />
            <h2 className="text-2xl font-bold tracking-tight text-white">
              GST Reports & Reconciliation
            </h2>
          </div>
          <p className="text-theme-sm text-sky-100 font-medium">
            Statutory HSN/SAC code summary statements and Inward ITC vs Outward
            liability reconciliation
          </p>
        </div>

        {/* Period Controller */}
        <div className="flex items-center rounded-xl bg-white/15 px-2 py-1 border border-white/20 shadow-xs self-start sm:self-auto">
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
      </div>

      {/* Simplified 2-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
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
          <GitCompare className="h-4 w-4" />
          <span>GST Reconciliation</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "hsn" && <HsnSummaryView initialPeriod={period} />}
      {activeTab === "reconciliation" && (
        <GstReconciliationView initialPeriod={period} />
      )}
    </div>
  );
}
