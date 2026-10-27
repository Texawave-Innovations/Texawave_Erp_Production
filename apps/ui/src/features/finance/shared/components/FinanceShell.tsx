"use client";

import {
  ArrowDownLeft,
  BarChart3,
  BookOpen,
  Building2,
  FolderTree,
  Landmark,
  Receipt,
  Scale,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { cn } from "@texawave-erp/ui-kit";

export type FinanceSectionId =
  | "expenses"
  | "payments-received"
  | "payments-made"
  | "banking"
  | "accounting"
  | "gst";

interface PrimaryTabConfig {
  id: FinanceSectionId;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  path?: string;
  activePathPrefixes: string[];
  disabled?: boolean;
  upcomingMessage?: string;
}

interface SubTabConfig {
  id: string;
  label: string;
  icon?:
    | React.ComponentType<{
        className?: string;
        "aria-hidden"?: boolean | "true" | "false";
      }>
    | undefined;
  path?: string | undefined;
  activePathPrefixes?: string[] | undefined;
  disabled?: boolean | undefined;
  badge?: string | undefined;
}

const PRIMARY_TABS: PrimaryTabConfig[] = [
  {
    id: "expenses",
    label: "Expenses",
    icon: Receipt,
    path: "/finance/expenses",
    activePathPrefixes: ["/finance/expenses"],
    disabled: false,
  },
  {
    id: "payments-received",
    label: "Payments Received",
    icon: ArrowDownLeft,
    path: "/finance/payments-received",
    activePathPrefixes: ["/finance/payments-received"],
    disabled: false,
  },
  {
    id: "payments-made",
    label: "Payments Made",
    icon: Wallet,
    path: "/finance/payments-made",
    activePathPrefixes: ["/finance/payments-made"],
    disabled: false,
  },
  {
    id: "banking",
    label: "Banking",
    icon: Building2,
    path: "/finance/banking",
    activePathPrefixes: ["/finance/banking"],
    disabled: false,
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: BookOpen,
    path: "/finance/accounts",
    activePathPrefixes: [
      "/finance/accounts",
      "/finance/journal-entries",
      "/finance/general-ledger",
      "/finance/reports",
      "/finance/accounting",
    ],
    disabled: false,
  },
  {
    id: "gst",
    label: "GST",
    icon: ShieldCheck,
    path: "/finance/gst",
    activePathPrefixes: ["/finance/gst"],
    disabled: false,
  },
];

const SUB_TABS_MAP: Record<FinanceSectionId, SubTabConfig[]> = {
  accounting: [
    {
      id: "accounts",
      label: "Chart of Accounts",
      icon: FolderTree,
      path: "/finance/accounts",
      activePathPrefixes: ["/finance/accounts"],
    },
    {
      id: "journal-entries",
      label: "Journal Entries",
      icon: Scale,
      path: "/finance/journal-entries",
      activePathPrefixes: ["/finance/journal-entries"],
    },
    {
      id: "general-ledger",
      label: "General Ledger",
      icon: BookOpen,
      path: "/finance/general-ledger",
      activePathPrefixes: ["/finance/general-ledger"],
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      path: "/finance/reports",
      activePathPrefixes: ["/finance/reports"],
      disabled: false,
    },
  ],
  expenses: [],
  "payments-received": [],
  "payments-made": [],
  banking: [],
  gst: [],
};

export interface FinanceShellProps {
  children: ReactNode;
}

/**
 * Shared Finance Workspace Shell
 *
 * Implements the Unified Financial Hub container featuring:
 * 1. Global Finance header and subtitle
 * 2. Six primary section navigation tabs (Expenses, Payments Received, Payments Made, Banking, Accounting, GST)
 * 3. Contextual sub-navigation bar (e.g. Chart of Accounts, Journal Entries, General Ledger)
 * 4. Strictly adheres to AGENTS.md: TexaOne Prime Blue palette, zero violet/purple/indigo, Nunito Sans, no AI decorations, no overflow clipping.
 */
export function FinanceShell({ children }: FinanceShellProps) {
  const pathname = usePathname();

  // Determine active primary section based on route prefix
  const activeSectionId = useMemo<FinanceSectionId>(() => {
    if (pathname.startsWith("/finance/expenses")) return "expenses";
    if (pathname.startsWith("/finance/payments-received"))
      return "payments-received";
    if (pathname.startsWith("/finance/payments-made")) return "payments-made";
    if (pathname.startsWith("/finance/banking")) return "banking";
    if (pathname.startsWith("/finance/gst")) return "gst";
    if (pathname.startsWith("/finance/reports")) return "accounting";
    // Default to accounting for /finance/accounts, /finance/journal-entries, /finance/general-ledger, /finance
    return "accounting";
  }, [pathname]);

  // Contextual sub-tabs for the current active section
  const currentSubTabs = useMemo(() => {
    return SUB_TABS_MAP[activeSectionId] ?? [];
  }, [activeSectionId]);

  // Determine active sub-tab based on route
  const activeSubTabId = useMemo(() => {
    for (const sub of currentSubTabs) {
      if (
        sub.activePathPrefixes?.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        )
      ) {
        return sub.id;
      }
    }
    return null;
  }, [pathname, currentSubTabs]);

  return (
    <div className="flex flex-col gap-5 pb-8 relative focus-within:z-30">
      {/* 1. Finance Hub Header Banner */}
      <div className="flex flex-col gap-1.5 border-b border-gray-200/80 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Finance
            </h1>
            <p className="text-theme-xs sm:text-theme-sm text-gray-500 dark:text-gray-400">
              Unified Financial Hub — Expenses, Banking, GST & General Ledger
              Accounting
            </p>
          </div>
        </div>

        {/* 2. Primary Navigation Tabs (6 Sections) */}
        <nav
          aria-label="Finance primary navigation"
          className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        >
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeSectionId;
            const isDisabled = Boolean(tab.disabled);

            if (isDisabled) {
              return (
                <span
                  key={tab.id}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200/60 bg-gray-50/70 px-3.5 py-2 text-theme-sm font-medium text-gray-400 dark:border-gray-800/60 dark:bg-gray-900/40 dark:text-gray-500 cursor-not-allowed opacity-75"
                  aria-disabled="true"
                  title={tab.upcomingMessage ?? `${tab.label} — Upcoming phase`}
                >
                  <Icon
                    className="h-4 w-4 text-gray-400 dark:text-gray-500"
                    aria-hidden="true"
                  />
                  <span>{tab.label}</span>
                </span>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.path!}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-theme-sm font-semibold transition-all",
                  isActive
                    ? "border border-blue-600/30 bg-linear-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-theme-xs"
                    : "border border-gray-200/80 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-white shadow-xs",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive
                      ? "text-white"
                      : "text-gray-500 dark:text-gray-400",
                  )}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. Contextual Sub-Navigation */}
      {currentSubTabs.length > 0 && (
        <nav
          aria-label={`${activeSectionId} sub-navigation`}
          className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-200/70 pb-2.5 dark:border-gray-800/70"
        >
          {currentSubTabs.map((subTab) => {
            const SubIcon = subTab.icon;
            const isSubActive = subTab.id === activeSubTabId;
            const isSubDisabled = Boolean(subTab.disabled);

            if (isSubDisabled) {
              return (
                <span
                  key={subTab.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-theme-xs font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-75"
                  aria-disabled="true"
                  title={`${subTab.label} — Coming soon`}
                >
                  {SubIcon && (
                    <SubIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{subTab.label}</span>
                  {subTab.badge && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {subTab.badge}
                    </span>
                  )}
                </span>
              );
            }

            return (
              <Link
                key={subTab.id}
                href={subTab.path!}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-theme-xs font-semibold transition-colors",
                  isSubActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 shadow-2xs"
                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/80 dark:hover:text-white border border-transparent",
                )}
                aria-current={isSubActive ? "page" : undefined}
              >
                {SubIcon && (
                  <SubIcon
                    className={cn(
                      "h-3.5 w-3.5",
                      isSubActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                    aria-hidden="true"
                  />
                )}
                <span>{subTab.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* 4. Active Page Content Shell */}
      <div className="relative focus-within:z-30">{children}</div>
    </div>
  );
}
