"use client";

import { Card, StatusBadge } from "@texawave-erp/ui-kit";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateTime, formatStatusLabel, scmStatusToken } from "./format";

export interface DashboardKpi {
  id: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  href: string;
  /** Shown as a tooltip — the one-line meaning of the figure. */
  note?: string;
}

export interface DashboardAction {
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface DashboardActivity {
  key: string;
  type: string;
  label: string;
  status: string;
  at?: string | null | undefined;
}

/** Clickable icon KPI tiles used at the top of every SCM domain dashboard
 * (legacy `DashboardKpiGrid`). */
export function DashboardKpiGrid({ kpis }: { kpis: readonly DashboardKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {kpis.map((k) => (
        <Link
          key={k.id}
          href={k.href}
          title={k.note}
          className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                <k.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white/90">
                  {k.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {k.label}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h3>
      {children}
    </Card>
  );
}

/** Legacy SCM dashboard layout: title + subtitle, KPI tiles, a Quick Actions
 * card and (where there is data) a Recent Activity card. */
export function ScmDashboardPage({
  title,
  subtitle,
  kpis,
  actions,
  activityTitle = "Recent Activity",
  activity,
  activityEmpty = "No activity yet.",
  footer,
}: {
  title: string;
  subtitle: string;
  kpis: readonly DashboardKpi[];
  actions?: readonly DashboardAction[];
  activityTitle?: string;
  activity?: readonly DashboardActivity[];
  activityEmpty?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">
          {title}
        </h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      <DashboardKpiGrid kpis={kpis} />

      {actions && actions.length > 0 ? (
        <SectionCard title="Quick Actions">
          <div className="flex flex-wrap gap-3">
            {actions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <a.icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {a.label}
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activity ? (
        <SectionCard title={activityTitle}>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              {activityEmpty}
            </p>
          ) : (
            <ul className="flex flex-col">
              {activity.map((a) => (
                <li
                  key={a.key}
                  className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 text-theme-sm last:border-0 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <span className="text-gray-500 dark:text-gray-400">
                      {a.type}
                    </span>{" "}
                    <span className="font-mono text-gray-900 dark:text-white/90">
                      {a.label}
                    </span>
                    {a.at ? (
                      <span className="ml-2 text-theme-xs text-gray-400">
                        {formatDateTime(a.at)}
                      </span>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={formatStatusLabel(a.status)}
                    colorToken={scmStatusToken(a.status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {footer}
    </div>
  );
}
