"use client";

import { Skeleton } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPortalNavItemActive, usePortalNavGroups } from "../nav";

/**
 * Employee portal sidebar, structured like the legacy one (TexaWave_ERP_old
 * src/modules/employee/EmployeePortalLayout.tsx): a narrow column of
 * always-open, uppercase-labelled groups (OVERVIEW, ATTENDANCE, LEAVES,
 * WORK & PROJECTS, EXPENSES, PAYROLL, MY INFO), the active item filled with
 * the brand gradient and a white marker bar, and a user card pinned to the
 * bottom. On small screens it is the same drawer the layout already toggled.
 */
export function PortalSidebar({
  open,
  onNavigate,
  name,
  initials,
}: {
  open: boolean;
  onNavigate: () => void;
  name: string;
  initials: string;
}) {
  const pathname = usePathname();
  const { groups, isPending, isError } = usePortalNavGroups();

  return (
    <aside
      id="app-sidebar"
      className={`w-52 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
        open ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl" : "hidden lg:flex"
      }`}
    >
      <nav aria-label="My Portal Navigation" className="flex-1 py-3">
        {isPending ? (
          <div className="flex flex-col gap-3 p-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
        ) : isError ? (
          <p className="p-3 text-theme-xs text-error-600">
            Could not load navigation.
          </p>
        ) : (
          groups.map((group, gi) => (
            <div key={group.label}>
              <p
                className={`mb-1 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 ${
                  gi === 0 ? "mt-2" : "mt-4"
                }`}
              >
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isPortalNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group mx-1.5 flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-theme-xs font-medium transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-brand-500 active:scale-95 ${
                      active
                        ? "translate-x-1.5 bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan font-semibold text-white shadow-md"
                        : "text-gray-600 hover:translate-x-1 hover:bg-brand-50 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        active ? "scale-110 text-white" : ""
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="ml-auto h-4 w-1 shrink-0 rounded-full bg-white"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </nav>

      {/* Bottom user card */}
      <div className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-800">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200/60 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan shadow-sm">
            <span className="text-[10px] font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-theme-xs font-semibold text-gray-800 dark:text-gray-100">
              {name}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Employee
            </p>
          </div>
          <span
            aria-hidden="true"
            className="ml-auto block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
          />
        </div>
      </div>
    </aside>
  );
}
