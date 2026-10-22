"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  Semantic3DIcon,
  type Icon3DName,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { useEmployee } from "@/features/hr/employees/hooks";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { OnboardingReviewPanel } from "@/features/hr/employees/components/OnboardingReviewPanel";
import { getEmployeeOnboarding } from "../api";
import { MISSING_LABELS } from "./OnboardingWizard";

/** Canonical sections mapping to the backend's required onboarding checklist */
interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  icon3d: Icon3DName;
  items: { key: string; label: string }[];
}

const ONBOARDING_SECTIONS: SectionDefinition[] = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Basic demographic identity and parental details",
    icon3d: "user",
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
    icon3d: "bell",
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
    icon3d: "departments",
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
    icon3d: "finance",
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
    icon3d: "access-control",
    items: [
      { key: "governmentIds.aadhaarNumber", label: "Aadhaar number" },
      { key: "governmentIds.panNumber", label: "PAN number" },
    ],
  },
  {
    id: "documents",
    title: "Compliance Documents",
    description: "Mandatory certificates, identity cards, and statements",
    icon3d: "documents",
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
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-8 animate-pulse">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
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
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8 animate-reveal">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/hr/employees/${employeeId}`}
          className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to employee record</span>
        </Link>
      </div>

      {/* Employee Identity Header */}
      {emp ? (
        <div
          className="relative overflow-visible rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <EmployeeIdentity
                name={emp.fullName}
                code={emp.employeeCode}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="wrap-break-word text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                    {emp.fullName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs ${
                      isDone
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isDone ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    {isDone ? "Complete" : "In onboarding"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-300/80 sm:text-sm">
                  <span>{emp.designation.name}</span>
                  {" · "}
                  <span>{emp.team.name}</span>
                  {emp.department?.name ? ` (${emp.department.name})` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#2f6396] dark:text-sky-300/80">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2 py-0.5 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    Joined {emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2 py-0.5 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                    <Building2 className="h-3.5 w-3.5 text-brand-500" />
                    {emp.employmentType.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/hr/employees/${employeeId}/profile`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-4 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <UserCheck className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                View full profile
              </Link>
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] ring-2 ring-white/70 dark:border-slate-700 dark:bg-slate-800">
                <Semantic3DIcon name="recruitment" size={32} alt="Employee onboarding" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* HR review of the submitted profile (approve / send back) */}
      {emp ? <OnboardingReviewPanel employee={emp} /> : null}

      {/* Progress Telemetry Card */}
      <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700 dark:bg-gray-800 select-none">
                <Semantic3DIcon name="tasks" size={30} />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                  Onboarding Readiness
                </span>
                <h2 className="text-2xl font-black tracking-tight text-[#0a3271] dark:text-white sm:text-3xl">
                  {completionPercentage}%{" "}
                  <span className="text-sm font-bold text-[#2f6396] dark:text-sky-300">
                    Complete
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-[#edf6ff]/80 px-3 py-1.5 text-xs font-bold text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                {completedSectionsCount} of {ONBOARDING_SECTIONS.length} sections complete
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-[#2f6396] shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">
                {completedItemCount} of {TOTAL_TRACKED_ITEMS} requirements met
              </span>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          <div className="mt-2 space-y-1.5">
            <div className="h-5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner dark:bg-slate-800">
              <div
                className={`flex h-full items-center justify-end rounded-full px-2 transition-all duration-500 ease-out shadow-xs ${
                  isDone
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-[#1769F5] via-[#0284c7] to-[#38bdf8]"
                }`}
                style={{ width: `${Math.max(completionPercentage, completionPercentage > 0 ? 8 : 0)}%` }}
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {completionPercentage >= 15 && (
                  <span className="text-[11px] font-black text-white leading-none drop-shadow-xs">
                    {completionPercentage}%
                  </span>
                )}
              </div>
            </div>
            {completionPercentage < 15 && (
              <div className="flex justify-end">
                <span className="text-[11px] font-bold text-brand-500 dark:text-sky-300">
                  {completionPercentage}% Complete
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action / Guidance Banner */}
      {!isDone ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-4.5 shadow-2xs dark:border-slate-700 dark:bg-slate-850">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/90 bg-white/95 p-1 text-brand-500 shadow-xs dark:border-slate-700 dark:bg-slate-800">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-[#0a3271] dark:text-white">
              Action Required from Employee
            </h3>
            <p className="mt-0.5 font-medium text-[#2f6396] dark:text-sky-300/80">
              This employee still has{" "}
              <span className="font-bold text-[#0a3271] dark:text-sky-100">
                {missingList.length} required field(s)
              </span>{" "}
              pending. The employee must sign in and finish these sections via their self-service onboarding wizard at{" "}
              <code className="rounded-md border border-sky-200/90 bg-white/90 px-1.5 py-0.5 font-semibold text-brand-500 dark:border-slate-700 dark:bg-slate-800">
                /onboarding
              </code>
              .
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-4.5 shadow-2xs dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/90 bg-white/95 p-1 text-emerald-600 shadow-xs dark:border-emerald-700 dark:bg-emerald-900">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-emerald-900 dark:text-white">
              Onboarding Complete
            </h3>
            <p className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-300">
              All mandatory onboarding checklist items have been fulfilled, verified, and saved to the employee record.
            </p>
          </div>
        </div>
      )}

      {/* Structured Sections Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-1 rounded-full bg-brand-500" />
            <h3 className="text-sm font-bold tracking-tight text-[#0a3271] dark:text-white">
              Onboarding Sections Checklist
            </h3>
          </div>
          <span className="rounded-full border border-sky-200/90 bg-[#edf6ff] px-2.5 py-0.5 text-xs font-bold text-brand-500 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">
            {isDone ? "All verified" : "Pending completion"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sectionSummaries.map((sec) => {
            const complete = sec.status === "complete";
            const inProgress = sec.status === "in-progress";

            return (
              <div
                key={sec.id}
                className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] dark:border-slate-700/80 dark:bg-gray-900"
              >
                {/* Prime Blue Header with Light Contrast */}
                <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
                      <Semantic3DIcon name={sec.icon3d} size={28} />
                    </div>
                    <div>
                      <h4 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                        {sec.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs ${
                      complete
                        ? "border border-sky-300 bg-sky-100 text-[#0a3271] dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                        : inProgress
                          ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {complete ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                        Complete
                      </>
                    ) : inProgress ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        In progress
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                        Pending
                      </>
                    )}
                  </span>
                </div>

                <div className="p-6">
                  <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#0a3271] dark:text-sky-100">
                        {sec.completedCount} / {sec.totalCount} fields completed
                      </span>
                      {complete ? (
                        <span className="text-brand-500 dark:text-cyan-400">
                          ✓ All requirements met
                        </span>
                      ) : (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {sec.missingItems.length} item(s) missing
                        </span>
                      )}
                    </div>

                    {sec.missingItems.length > 0 ? (
                      <ul className="mt-3.5 flex flex-wrap gap-2">
                        {sec.missingItems.map((item) => (
                          <li
                            key={item.key}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-2xs dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {MISSING_LABELS[item.key] ?? item.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
