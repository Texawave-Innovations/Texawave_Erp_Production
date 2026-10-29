"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { ApiError, formatDate } from "@texawave-erp/core";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Semantic3DIcon,
  type Icon3DName,
  Skeleton,
  StatusBadge,
  type StatusColorToken,
  useToast,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useUploadEmployeeDocument } from "@/features/hr/employee-documents/hooks";
import { useProfile, useSensitive } from "../hooks";
import { codeLabel, GENDER_OPTIONS, MARITAL_OPTIONS } from "../codes";
import {
  EMPLOYEE_WRITE_TEAM_OR_ALL,
  PROFILE_READ_ANY_SCOPE,
  PROFILE_WRITE_TEAM_OR_ALL,
  SENSITIVE_READ,
} from "../permissions";
import type { EmployeeProfileView, ProfileAddress } from "../types";

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

const STATUS_COLOR: Record<string, StatusColorToken> = {
  ACTIVE: "success",
  INACTIVE: "gray",
  RESIGNED: "warning",
  TERMINATED: "error",
};

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function DetailField({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-sky-100 bg-white/90 p-3.5 shadow-2xs transition-all hover:border-sky-200 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-theme-sm font-semibold text-[#0a3271] dark:text-white">
        {children}
      </dd>
    </div>
  );
}

function ProfileSection({
  title,
  description,
  icon: Icon,
  icon3d,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  icon3d?: Icon3DName;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] dark:border-slate-700/80 dark:bg-gray-900">
      {/* Prime Blue Header with Light Contrast */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex items-center gap-3">
          {icon3d ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Semantic3DIcon name={icon3d} size={28} />
            </div>
          ) : Icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Icon className="h-5 w-5 text-brand-500 dark:text-cyan-400" />
            </div>
          ) : null}
          <div>
            <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">
        <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
          {children}
        </div>
      </div>
    </div>
  );
}

function AddressCard({
  label,
  value,
}: {
  label: string;
  value: ProfileAddress | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-sky-100 bg-white/90 p-4 shadow-2xs transition-all hover:border-sky-200 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
        <MapPin className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
        {label}
      </h3>
      {value ? (
        <address className="wrap-break-word not-italic text-sm font-semibold leading-relaxed text-[#0a3271] dark:text-white">
          <span className="block font-bold">{value.address}</span>
          {value.area ? (
            <span className="text-slate-600 dark:text-slate-300">
              {value.area},{" "}
            </span>
          ) : null}
          {value.district ? (
            <span className="text-slate-600 dark:text-slate-300">
              {value.district}
            </span>
          ) : null}
          <div className="mt-1 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
            {value.city}, {value.state} {value.pincode}
            {value.country ? ` · ${value.country}` : ""}
          </div>
        </address>
      ) : (
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
          —
        </p>
      )}
    </div>
  );
}

/** Statutory and bank details. Hidden until the user asks, because every read is audited. */
function SensitiveSection({ id, canRead }: { id: number; canRead: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const query = useSensitive(id, revealed && canRead);

  if (!canRead) {
    return (
      <ProfileSection
        title="Statutory and Bank Details"
        icon3d="access-control"
        description="Protected financial and identity identifiers"
      >
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          You don&apos;t have permission to view statutory and bank details.
        </p>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="Statutory & Bank Details"
      icon3d="access-control"
      description="Each reveal is recorded in the platform security audit log."
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-expanded={revealed}
          className="rounded-xl border border-sky-200/90 bg-white px-3.5 py-1.5 text-xs font-bold text-[#0a3271] shadow-2xs hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200"
        >
          {revealed ? (
            <>
              <EyeOff className="h-3.5 w-3.5 mr-1.5 text-brand-500" />
              Hide details
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 mr-1.5 text-brand-500" />
              Show details
            </>
          )}
        </Button>
      }
    >
      {!revealed ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Confidential compliance data is masked by default. Click &quot;Show
            details&quot; when verification is required.
          </p>
        </div>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3 animate-pulse">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="Access to these details has changed">
            Contact an administrator.
          </Alert>
        ) : (
          <ErrorState
            title="Could not load statutory and bank details"
            onRetry={() => void query.refetch()}
          />
        )
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="PAN">{dash(query.data.panNumber)}</DetailField>
          <DetailField label="Aadhaar">
            {dash(query.data.aadhaarNumber)}
          </DetailField>
          <DetailField label="ESI number">
            {dash(query.data.esiNumber)}
          </DetailField>
          <DetailField label="PF number">
            {dash(query.data.pfNumber)}
          </DetailField>
          <DetailField label="Bank name">
            {dash(query.data.bankName)}
          </DetailField>
          <DetailField label="Branch">
            {dash(query.data.bankBranch)}
          </DetailField>
          <DetailField label="Account number">
            {dash(query.data.bankAccountNo)}
          </DetailField>
          <DetailField label="IFSC code">
            {dash(query.data.bankIfsc)}
          </DetailField>
        </dl>
      )}
    </ProfileSection>
  );
}

/** Read-only profile for one employee. */
export function ProfileView({ id }: { id: number }) {
  const canRead = usePermission(PROFILE_READ_ANY_SCOPE);
  const canWrite = usePermission(PROFILE_WRITE_TEAM_OR_ALL);
  const canEmployeeWrite = usePermission(EMPLOYEE_WRITE_TEAM_OR_ALL);
  const canReadSensitive = usePermission(SENSITIVE_READ);
  const query = useProfile(id);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to employee profiles"
      >
        Ask an administrator for the <code>hr.employee_profile.read</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-8 animate-pulse">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <div className="mx-auto w-full max-w-7xl rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
          <EmptyState
            title="Profile not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="inline-flex items-center gap-1.5 font-bold text-brand-500 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to employees
              </Link>
            }
          />
        </div>
      );
    }
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to this profile">
          Your access has changed. Contact an administrator.
        </Alert>
      );
    }
    return (
      <ErrorState
        title="Could not load this profile"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <ProfileBody
      id={id}
      data={query.data}
      canWrite={canWrite}
      canEmployeeWrite={canEmployeeWrite}
      canReadSensitive={canReadSensitive}
    />
  );
}

function ProfileBody({
  id,
  data,
  canWrite,
  canEmployeeWrite,
  canReadSensitive,
}: {
  id: number;
  data: EmployeeProfileView;
  canWrite: boolean;
  canEmployeeWrite: boolean;
  canReadSensitive: boolean;
}) {
  const { employee: e, profile: p } = data;
  const hasRecord = p.updatedAt !== null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const uploadMutation = useUploadEmployeeDocument(id);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file format",
        description: "Please select an image file (PNG, JPG, JPEG, or WebP).",
        variant: "warning",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Photo file size must not exceed 5MB.",
        variant: "warning",
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      await uploadMutation.mutateAsync({
        label: "Profile Photo",
        file,
        documentType: "PROFILE_PHOTO",
      });
      await queryClient.invalidateQueries({ queryKey: ["hr-profiles", id] });
      toast({
        title: "Profile photo updated",
        description:
          "The employee profile photo has been updated successfully.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload the profile photo. Please try again.",
        variant: "error",
      });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8 animate-reveal">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/hr/employees/${id}`}
          className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to employee record</span>
        </Link>
      </div>

      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      {/* Profile Header Hero Card */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative group shrink-0">
              <EmployeeIdentity
                name={e.fullName}
                code={e.employeeCode}
                avatarUrl={e.avatarUrl}
                size="lg"
              />
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  title="Upload or change employee photo"
                  aria-label="Upload or change employee photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-[#0284c7] active:scale-95 disabled:opacity-50 dark:border-slate-800"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="wrap-break-word text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                  {e.fullName}
                </h1>
                <StatusBadge
                  label={titleCase(e.status)}
                  colorToken={STATUS_COLOR[e.status] ?? "gray"}
                />
              </div>
              <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-300/80 sm:text-sm">
                <span>{e.employeeCode}</span>
                {p.updatedAt ? (
                  <> · Last profile update {formatDate(p.updatedAt)}</>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canWrite ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-brand-500" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-1.5 text-brand-500" />
                )}
                {isUploadingPhoto
                  ? "Uploading..."
                  : e.avatarUrl
                    ? "Change photo"
                    : "Upload photo"}
              </Button>
            ) : null}
            {canWrite ? (
              <Link
                href={`/hr/employees/${id}/profile/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-4 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <Edit className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                Edit profile
              </Link>
            ) : null}
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] ring-2 ring-white/70 dark:border-slate-700 dark:bg-slate-800">
              <Semantic3DIcon
                name="profiles"
                size={32}
                alt="Employee profile"
              />
            </div>
          </div>
        </div>
      </div>

      {!hasRecord ? (
        <Alert variant="info" title="No profile details recorded yet">
          {canWrite
            ? "Personal, family, address and bank details have not been submitted. Use Edit profile to add them."
            : "Personal, family, address and bank details have not been submitted yet."}
        </Alert>
      ) : null}

      {/* Balanced 2-Column Grid of Profile Sections */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Left Column: Personal, Family, Residential Addresses */}
        <div className="flex flex-col gap-6">
          {/* Personal Details */}
          <ProfileSection
            title="Personal Information"
            icon3d="user"
            description="Core personal identity and demographics"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Title">{dash(p.title)}</DetailField>
              <DetailField label="Date of birth" icon={Calendar}>
                {dash(p.dateOfBirth)}
              </DetailField>
              <DetailField label="Gender">
                {dash(codeLabel(GENDER_OPTIONS, p.gender))}
              </DetailField>
              <DetailField label="Marital status">
                {dash(codeLabel(MARITAL_OPTIONS, p.maritalStatus))}
              </DetailField>
              <DetailField label="Blood group">
                {dash(p.bloodGroup)}
              </DetailField>
              <DetailField label="Languages spoken">
                {p.languages.length > 0 ? p.languages.join(", ") : "—"}
              </DetailField>
            </dl>
          </ProfileSection>

          {/* Family Details */}
          <ProfileSection
            title="Family Details"
            icon3d="people"
            description="Parental and marital records"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Father's name">
                {dash(p.fatherName)}
              </DetailField>
              <DetailField label="Mother's name">
                {dash(p.motherName)}
              </DetailField>
              <DetailField label="Spouse name">
                {dash(p.spouseName)}
              </DetailField>
            </dl>
          </ProfileSection>

          {/* Addresses */}
          <ProfileSection
            title="Residential Addresses"
            icon3d="departments"
            description="Current and permanent residential records"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AddressCard label="Current Address" value={p.presentAddress} />
              <AddressCard
                label="Permanent Address"
                value={p.permanentAddress}
              />
            </div>
          </ProfileSection>
        </div>

        {/* Right Column: Contact, Emergency Contact, Experience, Core Employment */}
        <div className="flex flex-col gap-6">
          {/* Contact Information */}
          <ProfileSection
            title="Contact Details"
            icon3d="overview"
            description="Maintained directly on the employee identity record"
            action={
              canEmployeeWrite ? (
                <Link
                  href={`/hr/employees/${id}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200/90 bg-white px-2.5 py-1 text-xs font-bold text-brand-500 shadow-2xs transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Link>
              ) : null
            }
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Work email" icon={Mail}>
                {dash(e.workEmail)}
              </DetailField>
              <DetailField label="Phone" icon={Phone}>
                {dash(e.phone)}
              </DetailField>
            </dl>
          </ProfileSection>

          {/* Emergency Contact */}
          <ProfileSection
            title="Emergency Contact"
            icon3d="bell"
            description="Primary emergency contact and relationship"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Contact name">
                {dash(p.emergencyContact.name)}
              </DetailField>
              <DetailField label="Relationship">
                {dash(p.emergencyContact.relation)}
              </DetailField>
              <DetailField label="Phone number" icon={Phone}>
                {dash(p.emergencyContact.phone)}
              </DetailField>
            </dl>
          </ProfileSection>

          {/* Experience */}
          <ProfileSection
            title="Prior Work Experience"
            icon3d="recruitment"
            description="Employment history and domain experience"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Fresher status">
                {p.isFresher ? "Yes" : "No"}
              </DetailField>
              <DetailField label="Total experience">
                {p.experienceYears !== null
                  ? `${p.experienceYears} years`
                  : "—"}
              </DetailField>
              <DetailField label="Previous company">
                {dash(p.previousCompany)}
              </DetailField>
              <DetailField label="Previous designation">
                {dash(p.previousRole)}
              </DetailField>
            </dl>
          </ProfileSection>

          {/* Employment Record */}
          <ProfileSection
            title="Core Employment Record"
            icon3d="org-chart"
            description="Synchronized from central workforce ledger"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Employee code">{e.employeeCode}</DetailField>
              <DetailField label="Date of joining" icon={Calendar}>
                {e.dateOfJoining.slice(0, 10)}
              </DetailField>
              <DetailField label="Employment status">
                {titleCase(e.status)}
              </DetailField>
            </dl>
          </ProfileSection>
        </div>

        {/* Statutory & Bank Details (Full Width on XL) */}
        <div className="xl:col-span-2">
          <SensitiveSection id={id} canRead={canReadSensitive} />
        </div>
      </div>
    </div>
  );
}
