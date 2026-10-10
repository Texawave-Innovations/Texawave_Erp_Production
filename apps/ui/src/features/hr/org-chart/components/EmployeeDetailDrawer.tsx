"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Building2,
  Calendar,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
  X,
} from "lucide-react";
import { Skeleton } from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useEmployee } from "@/features/hr/employees/hooks";
import { EmployeeStatusBadge } from "@/features/hr/employees/components/EmployeeStatusBadge";
import type { OrgChartNode } from "../types";

export interface EmployeeDetailDrawerProps {
  node: OrgChartNode | null;
  onClose: () => void;
}

function DrawerRow({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {Icon ? (
          <Icon className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
        ) : null}
        {label}
      </dt>
      <dd className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
        {children}
      </dd>
    </div>
  );
}

/**
 * Enterprise slide-in drawer presenting full personnel telemetry for the selected org chart node.
 * Features live status badge, reporting structure, contact info, and direct link to full profile.
 */
export function EmployeeDetailDrawer({
  node,
  onClose,
}: EmployeeDetailDrawerProps) {
  const empQuery = useEmployee(node ? node.id : 0);

  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  const emp = empQuery.data;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-xs transition-opacity duration-200 ${
          node ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={node ? `${node.fullName} details` : undefined}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col justify-between overflow-y-auto border-l border-neutral-200 bg-white p-6 shadow-xl transition-transform duration-250 ease-out dark:border-neutral-800 dark:bg-neutral-900 sm:max-w-sm ${
          node ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {node ? (
          <div className="flex flex-col gap-6">
            {/* Drawer Header with Close Button */}
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Personnel Details
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Employee Hero Identity Card */}
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
              <div className="flex items-center gap-3.5">
                <EmployeeIdentity
                  name={node.fullName}
                  code={node.employeeCode}
                  avatarSize="lg"
                />
              </div>

              <div className="flex flex-col gap-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                    {node.fullName}
                  </span>
                  {emp ? (
                    <EmployeeStatusBadge status={emp.status} />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {node.designation.name}
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-500">
                  {node.department?.name ?? "General"} · {node.team.name}
                </span>
              </div>
            </div>

            {/* Reporting Structure Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Reporting Structure
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <DrawerRow label="Direct Reports" icon={Users}>
                  {node.directReportCount}{" "}
                  {node.directReportCount === 1 ? "person" : "people"}
                </DrawerRow>
                <DrawerRow label="Reporting To" icon={User}>
                  {emp?.reportsTo ? (
                    <span className="truncate">{emp.reportsTo.fullName}</span>
                  ) : (
                    "—"
                  )}
                </DrawerRow>
              </div>
            </div>

            {/* Organization Placement Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Organization
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DrawerRow label="Department" icon={Building2}>
                  {node.department?.name ?? "General"}
                </DrawerRow>
                <DrawerRow label="Team">{node.team.name}</DrawerRow>
                <DrawerRow label="Designation">
                  {node.designation.name}
                </DrawerRow>
                <DrawerRow label="Employment Type">
                  {emp?.employmentType.name ?? "Permanent"}
                </DrawerRow>
              </div>
            </div>

            {/* Contact & Verification Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Communication & Joining
              </h3>
              {empQuery.isPending ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <DrawerRow label="Work Email" icon={Mail}>
                    {emp?.workEmail ? (
                      <a
                        href={`mailto:${emp.workEmail}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {emp.workEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DrawerRow>
                  <DrawerRow label="Phone" icon={Phone}>
                    {emp?.phone ? (
                      <a
                        href={`tel:${emp.phone}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {emp.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DrawerRow>
                  <DrawerRow label="Date of Joining" icon={Calendar}>
                    {emp?.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : "—"}
                  </DrawerRow>
                  {emp?.workLocation?.name ? (
                    <DrawerRow label="Work Location" icon={MapPin}>
                      {emp.workLocation.name}
                    </DrawerRow>
                  ) : null}
                </div>
              )}
            </div>

            {/* Footer Action: View Full Profile */}
            <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <Link
                href={`/hr/employees/${node.id}/profile`}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View full profile
              </Link>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
