"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useQualityDashboard } from "../hooks";

import {
  AlertTriangle,
  BadgeAlert,
  ClipboardCheck,
  FileText,
  type LucideIcon,
  Plus,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { formatStatusLabel } from "../../shared/format";
import {
  ScmDashboardPage,
  type DashboardAction,
} from "../../shared/ScmDashboardPage";
const KPI_ICONS: Record<string, LucideIcon> = {
  pending: ClipboardCheck,
  "in-progress": SearchCheck,
  "completed-today": ShieldCheck,
  passed: ShieldCheck,
  partial: AlertTriangle,
  failed: BadgeAlert,
  quarantined: ShieldAlert,
  "critical-defects": BadgeAlert,
};

const ACTIONS: DashboardAction[] = [
  { label: "New Inspection", icon: Plus, href: "/scm/quality/inspections" },
  {
    label: "Inspection Templates",
    icon: ClipboardCheck,
    href: "/scm/quality/templates",
  },
  { label: "Defect Master", icon: BadgeAlert, href: "/scm/quality/defects" },
  { label: "Quarantine", icon: ShieldAlert, href: "/scm/quality/quarantine" },
];

const sum = (m: Record<string, number>, keys: string[]) =>
  keys.reduce((s, k) => s + (m[k] ?? 0), 0);

/** Legacy `ScmQualityDashboard`: QC pipeline KPIs with links into each list. */
export function QualityDashboardView() {
  const query = useQualityDashboard();

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to quality">
          Ask an administrator for the <code>scm.quality.read</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const d = query.data;
  const cards: {
    id: string;
    label: string;
    value: number | string;
    note: string;
    href: string;
    tone?: "warning" | "brand" | "success" | "info" | "blue";
  }[] = [
    {
      id: "pending",
      label: "Pending Inspection",
      value: sum(d.byStatus, ["PENDING_INSPECTION"]),
      note: "Not yet started",
      href: "/scm/quality/inspections",
      tone: "warning",
    },
    {
      id: "in-progress",
      label: "In Progress",
      value: sum(d.byStatus, ["IN_PROGRESS"]),
      note: "Being inspected",
      href: "/scm/quality/inspections",
      tone: "blue",
    },
    {
      id: "completed-today",
      label: "Completed Today",
      value: d.completedToday,
      note: "Finished today",
      href: "/scm/quality/inspections",
      tone: "success",
    },
    {
      id: "passed",
      label: "Passed",
      value: sum(d.byResult, ["PASSED"]),
      note: "No issues found",
      href: "/scm/quality/inspections",
      tone: "success",
    },
    {
      id: "partial",
      label: "Partially Passed",
      value: sum(d.byResult, ["PARTIALLY_PASSED"]),
      note: "Mixed outcome",
      href: "/scm/quality/inspections",
      tone: "warning",
    },
    {
      id: "failed",
      label: "Failed",
      value: sum(d.byResult, ["FAILED"]),
      note: "Rejected on inspection",
      href: "/scm/quality/inspections",
      tone: "brand",
    },
    {
      id: "quarantined",
      label: "Quarantined",
      value: d.quarantinedActive,
      note: "Held for review",
      href: "/scm/quality/quarantine",
      tone: "brand",
    },
    {
      id: "critical-defects",
      label: "Critical / High Defects",
      value: d.criticalDefects,
      note: "Active defect codes",
      href: "/scm/quality/defects",
      tone: "warning",
    },
  ];

  return (
    <ScmDashboardPage
      title="Quality Overview"
      subtitle="Incoming, customer return, inventory and pre-dispatch QC inspections, defects and quarantine."
      kpis={cards.map((c) => ({
        id: c.id,
        label: c.label,
        value: c.value,
        href: c.href,
        note: c.note,
        icon: KPI_ICONS[c.id] ?? FileText,
      }))}
      actions={ACTIONS}
      activityTitle="Recent Inspections"
      activityEmpty="No quality inspections yet."
      activity={d.recent.map((i) => ({
        key: String(i.id),
        type: formatStatusLabel(i.inspectionType),
        label: i.inspectionNumber,
        status: i.status,
        at: i.createdAt,
      }))}
      footer={
        d.avgInspectionMinutes !== null ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Average inspection time: {d.avgInspectionMinutes} minute(s).
          </p>
        ) : null
      }
    />
  );
}
