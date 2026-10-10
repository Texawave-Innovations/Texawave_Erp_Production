"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { useEmployee } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { getEmployeeOnboarding } from "../api";
import { MISSING_LABELS } from "./OnboardingWizard";

/** Canonical sections mapping to the backend's required onboarding checklist */
interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { key: string; label: string }[];
}

const ONBOARDING_SECTIONS: SectionDefinition[] = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Basic demographic identity and parental details",
    icon: User,
    items: [
      { key: "personal.dateOfBirth", label: "Date of birth" },
      { key: "personal.gender", label: "Gender" },
      { key: "personal.fatherName", label: "Father's name" },
      { key: "personal.motherName", label: "Mother's name" },
    ],
  },
  {
    id: "emergency",
    title: "Emergency Contact",
    description: "Primary point of contact for emergency notifications",
    icon: Phone,
    items: [
      { key: "personal.emergencyContactName", label: "Contact name" },
      { key: "personal.emergencyContactRelation", label: "Relation" },
      { key: "personal.emergencyContactPhone", label: "Phone number" },
    ],
  },
  {
    id: "address",
    title: "Address Information",
    description: "Permanent residential and correspondence location",
    icon: MapPin,
    items: [
      { key: "permanentAddress.addressLine", label: "Address line" },
      { key: "permanentAddress.district", label: "District" },
      { key: "permanentAddress.city", label: "City" },
      { key: "permanentAddress.state", label: "State" },
      { key: "permanentAddress.pincode", label: "Pincode" },
    ],
  },
  {
    id: "bank",
    title: "Bank Information",
    description: "Salary disbursement account and branch information",
    icon: CreditCard,
    items: [
      { key: "bank.accountHolderName", label: "Account holder name" },
      { key: "bank.accountNumberEncrypted", label: "Bank account number" },
      { key: "bank.ifsc", label: "IFSC code" },
      { key: "bank.bankName", label: "Bank name" },
    ],
  },
  {
    id: "statutory",
    title: "Statutory Identification",
    description: "Government-issued compliance identifiers",
    icon: ShieldCheck,
    items: [
      { key: "governmentIds.aadhaarNumber", label: "Aadhaar number" },
      { key: "governmentIds.panNumber", label: "PAN number" },
    ],
  },
  {
    id: "documents",
    title: "Compliance Documents",
    description: "Mandatory certificates, identity cards, and statements",
    icon: FileText,
    items: [
      { key: "document.PROFILE_PHOTO", label: "Profile photo" },
      { key: "document.AADHAAR", label: "Aadhaar card" },
      { key: "document.PAN", label: "PAN card" },
      { key: "document.BANK_STATEMENT", label: "Bank statement" },
      { key: "document.CERT_10TH", label: "10th certificate" },
      { key: "document.CERT_12TH", label: "12th certificate" },
      { key: "document.CERT_GRADUATION", label: "Graduation certificate" },
    ],
  },
];

const TOTAL_TRACKED_ITEMS = 25; // 4 + 3 + 5 + 4 + 2 + 7

/** HR's read-only view of one employee's onboarding progress. */
export function EmployeeOnboardingProgress({
  employeeId,
}: {
  employeeId: number;
}) {
  const empQuery = useEmployee(employeeId);
  const onboardingQuery = useQuery({
    queryKey: ["onboarding", "hr-progress", employeeId],
    queryFn: () => getEmployeeOnboarding(employeeId),
  });

  if (onboardingQuery.isPending || empQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (onboardingQuery.isError) {
    const error = onboardingQuery.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="Access Denied">
          You do not have permission to view this employee&apos;s onboarding.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void onboardingQuery.refetch()} />;
  }

  const missingList = onboardingQuery.data.missing ?? [];
  const missingSet = new Set(missingList);
  const isDone =
    onboardingQuery.data.onboardingStatus === "COMPLETE" ||
    missingList.length === 0;

  const completedItemCount = Math.max(
    0,
    TOTAL_TRACKED_ITEMS - missingList.length,
  );
  const completionPercentage = Math.min(
    100,
    Math.round((completedItemCount / TOTAL_TRACKED_ITEMS) * 100),
  );

  const emp = empQuery.data;

  // Compute section states
  const sectionSummaries = ONBOARDING_SECTIONS.map((sec) => {
    const sectionMissing = sec.items.filter((item) => missingSet.has(item.key));
    const completedCount = sec.items.length - sectionMissing.length;
    let status: "complete" | "in-progress" | "pending" = "pending";

    if (sectionMissing.length === 0) {
      status = "complete";
    } else if (completedCount > 0) {
      status = "in-progress";
    }

    return {
      ...sec,
      status,
      completedCount,
      totalCount: sec.items.length,
      missingItems: sectionMissing,
    };
  });

  const completedSectionsCount = sectionSummaries.filter(
    (s) => s.status === "complete",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/hr/employees/${employeeId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to employee record
        </Link>
      </div>

      {/* Employee Identity Header */}
      {emp ? (
        <Card className="border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <EmployeeIdentity
                name={emp.fullName}
                code={emp.employeeCode}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                    {emp.fullName}
                  </h2>
                  <StatusBadge
                    label={isDone ? "Complete" : "In onboarding"}
                    colorToken={isDone ? "success" : "warning"}
                  />
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 sm:text-sm">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {emp.designation.name}
                  </span>{" "}
                  · {emp.team.name}
                  {emp.department?.name ? ` (${emp.department.name})` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined{" "}
                    {emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {emp.employmentType.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/hr/employees/${employeeId}/profile`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <UserCheck className="h-3.5 w-3.5" />
                View full profile
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Progress Telemetry Card */}
      <Card className="border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Onboarding Readiness
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {completionPercentage}% Complete
              </h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {completedSectionsCount} of {ONBOARDING_SECTIONS.length}{" "}
                sections complete
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {completedItemCount} of {TOTAL_TRACKED_ITEMS} required
                requirements met
              </p>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isDone ? "bg-emerald-500" : "bg-brand-600"
              }`}
              style={{ width: `${completionPercentage}%` }}
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </Card>

      {/* Action / Guidance Banner */}
      {!isDone ? (
        <Alert
          variant="info"
          title="Action Required from Employee"
          className="border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100"
        >
          <p className="text-xs">
            This employee still has{" "}
            <span className="font-semibold">
              {missingList.length} required field(s)
            </span>{" "}
            pending. The employee must sign in and finish these sections via
            their self-service onboarding wizard at{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[11px] dark:bg-blue-900/60">
              /onboarding
            </code>
            .
          </p>
        </Alert>
      ) : (
        <Alert
          variant="success"
          title="Onboarding Complete"
          className="border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          <p className="text-xs">
            All mandatory onboarding checklist items have been fulfilled,
            verified, and saved to the employee record.
          </p>
        </Alert>
      )}

      {/* Structured Sections Checklist */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Onboarding Sections Checklist
          </h3>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {isDone ? "All verified" : "Pending completion"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sectionSummaries.map((sec) => {
            const Icon = sec.icon;
            const complete = sec.status === "complete";
            const inProgress = sec.status === "in-progress";

            return (
              <Card
                key={sec.id}
                className={`relative overflow-hidden border p-5 transition-all shadow-xs ${
                  complete
                    ? "border-emerald-200/80 bg-white dark:border-emerald-900/40 dark:bg-neutral-900"
                    : inProgress
                      ? "border-amber-200/80 bg-white dark:border-amber-900/40 dark:bg-neutral-900"
                      : "border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        complete
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : inProgress
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {sec.title}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      complete
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : inProgress
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {complete ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </>
                    ) : inProgress ? (
                      <>
                        <Clock className="h-3 w-3" />
                        In progress
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        Pending
                      </>
                    )}
                  </span>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
                  <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">
                      {sec.completedCount} / {sec.totalCount} fields completed
                    </span>
                    {complete ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ All requirements met
                      </span>
                    ) : (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {sec.missingItems.length} item(s) missing
                      </span>
                    )}
                  </div>

                  {sec.missingItems.length > 0 ? (
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {sec.missingItems.map((item) => (
                        <li
                          key={item.key}
                          className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {MISSING_LABELS[item.key] ?? item.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
