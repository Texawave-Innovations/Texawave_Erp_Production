"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ErrorState, PageHeader } from "@texawave-erp/ui-kit";
import { BarChart3, FileCheck2, LineChart, Scale } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { FINANCE_REPORTS_READ } from "../permissions";
import { BalanceSheetView } from "./BalanceSheetView";
import { ProfitAndLossView } from "./ProfitAndLossView";
import { TrialBalanceView } from "./TrialBalanceView";

export type FinancialReportSubTab =
  "balance-sheet" | "profit-and-loss" | "trial-balance";

interface SubTabItem {
  id: FinancialReportSubTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REPORT_TABS: SubTabItem[] = [
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    description: "Financial Position Snapshot (Assets, Liabilities, Equity)",
    icon: Scale,
  },
  {
    id: "profit-and-loss",
    label: "Profit & Loss",
    description: "Operating Performance (Revenue, Expenses, Net Income)",
    icon: LineChart,
  },
  {
    id: "trial-balance",
    label: "Trial Balance",
    description: "Ledger Debit & Credit Balancing Verification",
    icon: FileCheck2,
  },
];

export interface ReportsViewProps {
  hideHeader?: boolean;
}

export function ReportsView({ hideHeader = false }: ReportsViewProps = {}) {
  const canRead = usePermission(FINANCE_REPORTS_READ);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: FinancialReportSubTab = useMemo(() => {
    const rawTab = searchParams.get("tab") as FinancialReportSubTab | null;
    if (rawTab && REPORT_TABS.some((t) => t.id === rawTab)) {
      return rawTab;
    }
    return "balance-sheet";
  }, [searchParams]);

  const handleTabChange = (tabId: FinancialReportSubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (!canRead) {
    return (
      <ErrorState
        title="Access Restricted"
        description="You do not have permission to view Financial Statements and Reports (finance.journal.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      {!hideHeader && (
        <PageHeader
          title="Financial Statements & Reports"
          description="Comprehensive statutory financial statements derived directly from double-entry general ledger records."
          badge={
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-300 text-theme-xs font-semibold">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Statutory Reports</span>
            </div>
          }
        />
      )}

      {/* Subtab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 dark:border-gray-800">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-theme-sm font-semibold transition-colors ${
                isActive
                  ? "border-[#1769F5] text-[#1769F5] dark:border-sky-400 dark:text-sky-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Report View */}
      <div className="pt-1">
        {activeTab === "balance-sheet" && <BalanceSheetView />}
        {activeTab === "profit-and-loss" && <ProfitAndLossView />}
        {activeTab === "trial-balance" && <TrialBalanceView />}
      </div>
    </div>
  );
}
