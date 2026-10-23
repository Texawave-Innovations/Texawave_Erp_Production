"use client";

import { Card, StatusBadge } from "@texawave-erp/ui-kit";
import {
  AlertTriangle,
  ArrowRight,
  ListChecks,
  PackageSearch,
  Siren,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { formatStatusLabel } from "../../shared/format";
import { useControlTower, useReplenishment } from "../hooks";

const TOP_ALERTS = 4;
const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const SEVERITY_TOKEN = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "gray",
} as const;

function SummaryTile({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  href: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 p-3 text-left transition-shadow hover:shadow-md dark:border-gray-700"
    >
      <div
        className={`inline-grid h-8 w-8 place-items-center rounded-lg ${tone}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="mt-1.5 text-xl font-bold text-gray-900 dark:text-white/90">
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </Link>
  );
}

/** Compact Advanced SCM summary at the foot of the Overview (legacy
 * `AdvancedScmSummary`): alert / action / reorder counts and the top alerts,
 * drawn from the Control Tower and Replenishment feeds. */
export function AdvancedScmSummary() {
  const tower = useControlTower();
  const reorder = useReplenishment();
  const loading = tower.isPending || reorder.isPending;
  const failed = tower.isError || reorder.isError;

  const exceptions = useMemo(() => tower.data ?? [], [tower.data]);
  const criticalHigh = exceptions.filter((e) => e.severity === "HIGH").length;
  const topAlerts = useMemo(
    () =>
      [...exceptions]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .slice(0, TOP_ALERTS),
    [exceptions],
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning-50 text-warning-600 dark:bg-warning-500/15">
            <Siren className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
              Advanced SCM
            </h3>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Operational exceptions, replenishment and action items
            </p>
          </div>
        </div>
        <Link
          href="/scm/advanced/control-tower"
          className="flex items-center gap-1 text-theme-sm font-medium text-brand-600 hover:underline"
        >
          Control Tower{" "}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {failed ? (
        <div className="flex items-center justify-between gap-3 text-theme-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <AlertTriangle
              className="h-4 w-4 text-error-500"
              aria-hidden="true"
            />
            Couldn&apos;t load SCM alerts.
          </span>
          <button
            type="button"
            className="font-medium text-brand-600 hover:underline"
            onClick={() => {
              void tower.refetch();
              void reorder.refetch();
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile
              icon={AlertTriangle}
              label="Critical/High Alerts"
              value={loading ? "…" : criticalHigh}
              href="/scm/advanced/control-tower"
              tone="bg-error-50 text-error-600 dark:bg-error-500/15"
            />
            <SummaryTile
              icon={ListChecks}
              label="Open Actions"
              value={loading ? "…" : exceptions.length}
              href="/scm/advanced/control-tower"
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/15"
            />
            <SummaryTile
              icon={PackageSearch}
              label="Reorder Now"
              value={loading ? "…" : (reorder.data?.length ?? 0)}
              href="/scm/advanced/replenishment"
              tone="bg-success-50 text-success-600 dark:bg-success-500/15"
            />
          </div>

          {!loading && topAlerts.length > 0 ? (
            <ul className="flex flex-col">
              {topAlerts.map((e, i) => (
                <li key={`${e.type}-${i}`}>
                  <Link
                    href={e.path}
                    className="flex items-center justify-between gap-2 rounded border-b border-gray-100 px-1 py-2 text-theme-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusBadge
                        label={formatStatusLabel(e.severity)}
                        colorToken={SEVERITY_TOKEN[e.severity]}
                      />
                      <span className="truncate text-gray-900 dark:text-white/90">
                        {e.title}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatStatusLabel(e.type)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {!loading && topAlerts.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No open exceptions — supply chain is healthy.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
