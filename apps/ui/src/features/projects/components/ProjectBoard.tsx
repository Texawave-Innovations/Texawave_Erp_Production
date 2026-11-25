import Link from "next/link";
import { Flag } from "lucide-react";
import { EmptyState } from "@texawave-erp/ui-kit";
import { HealthBadge } from "./HealthBadge";
import { ProjectMeter } from "./ProjectMeter";
import { formatCurrency, formatDate, percent } from "../format";
import type { Project, ProjectStatus } from "../types";

const COLUMNS: { status: ProjectStatus; label: string }[] = [
  { status: "active", label: "Active" },
  { status: "on_hold", label: "On Hold" },
  { status: "completed", label: "Completed" },
  { status: "cancelled", label: "Cancelled" },
];

/** Read-only board of projects, one column per status. Cards link to the tracker. */
export function ProjectBoard({ projects }: { projects: readonly Project[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto p-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = projects.filter((p) => p.status === col.status);
        return (
          <section
            key={col.status}
            aria-label={`${col.label} projects`}
            className="flex min-w-64 flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50"
          >
            <header className="flex items-center justify-between px-1">
              <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                {col.label}
              </h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-theme-xs font-medium text-gray-600 shadow-theme-xs dark:bg-gray-800 dark:text-gray-300">
                {items.length}
              </span>
            </header>
            {items.length === 0 ? (
              <EmptyState title={`No ${col.label.toLowerCase()} projects`} />
            ) : (
              items.map((p) => {
                const done = p.milestones.filter(
                  (m) => m.status === "completed",
                ).length;
                const hPct = percent(
                  p.totalLoggedHours ?? 0,
                  Number(p.expectedHours) || 0,
                );
                const spent = Number(p.actualCost) || 0;
                const price = Number(p.projectPrice) || 0;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition-shadow hover:shadow-theme-sm focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-dark"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-theme-xs font-semibold text-brand-700 dark:text-cyan-300">
                          {p.projectCode}
                        </p>
                        <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                          {p.name}
                        </p>
                        <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                          {p.customerName ||
                            p.salesCustomer?.companyName ||
                            "—"}
                        </p>
                      </div>
                      <HealthBadge health={p.health} />
                    </div>
                    <ProjectMeter
                      label="Hours used"
                      used={`${p.totalLoggedHours ?? 0}h`}
                      total={`/ ${Number(p.expectedHours) || 0}h`}
                      pct={hPct}
                    />
                    <ProjectMeter
                      label="Budget used"
                      used={formatCurrency(spent)}
                      total={`/ ${formatCurrency(price)}`}
                      pct={percent(spent, price)}
                    />
                    <div className="flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Flag className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400" />
                        {done}/{p.milestones.length} milestones
                      </span>
                      <span>Due {formatDate(p.plannedEndDate)}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
