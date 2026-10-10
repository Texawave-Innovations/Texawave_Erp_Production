"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit,
  Eye,
  EyeOff,
  Home,
  Briefcase,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  type StatusColorToken,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useProfile, useSensitive } from "../hooks";
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
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 transition-colors hover:border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:border-neutral-700">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {children}
      </dd>
    </div>
  );
}

function ProfileSection({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon ? (
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
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
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 transition-colors hover:border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:border-neutral-700">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        <MapPin className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
        {label}
      </h3>
      {value ? (
        <address className="wrap-break-word not-italic text-sm font-medium leading-relaxed text-neutral-800 dark:text-neutral-200">
          {value.address}
          {value.area ? <>, {value.area}</> : null}
          {value.district ? <>, {value.district}</> : null}
          <br />
          {value.city}, {value.state} {value.pincode}
          {value.country ? <>, {value.country}</> : null}
        </address>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">—</p>
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
        icon={Lock}
        description="Protected financial and identity identifiers"
      >
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          You don&apos;t have permission to view statutory and bank details.
        </p>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="Statutory & Bank Details"
      icon={Lock}
      description="Each reveal is recorded in the platform security audit log."
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-expanded={revealed}
        >
          {revealed ? (
            <>
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              Hide details
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Show details
            </>
          )}
        </Button>
      }
    >
      {!revealed ? (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200/70 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Confidential compliance data is masked by default. Click &quot;Show
            details&quot; when verification is required.
          </p>
        </div>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3 animate-pulse">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
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
      <div className="flex flex-col gap-4 animate-pulse">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card className="p-8">
          <EmptyState
            title="Profile not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to employees
              </Link>
            }
          />
        </Card>
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

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/hr/employees/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to employee record
        </Link>
      </div>

      {/* Profile Header Hero Card */}
      <Card className="overflow-hidden border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <EmployeeIdentity
              name={e.fullName}
              code={e.employeeCode}
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="wrap-break-word text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-2xl">
                  {e.fullName}
                </h1>
                <StatusBadge
                  label={titleCase(e.status)}
                  colorToken={STATUS_COLOR[e.status] ?? "gray"}
                />
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 sm:text-sm">
                <span className="font-mono text-neutral-800 dark:text-neutral-200">
                  {e.employeeCode}
                </span>
                {p.updatedAt ? (
                  <>
                    {" "}
                    · Last profile update{" "}
                    {new Date(p.updatedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <Link
                href={`/hr/employees/${id}/profile/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-brand-700"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit profile
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      {!hasRecord ? (
        <Alert variant="info" title="No profile details recorded yet">
          {canWrite
            ? "Personal, family, address and bank details have not been submitted. Use Edit profile to add them."
            : "Personal, family, address and bank details have not been submitted yet."}
        </Alert>
      ) : null}

      {/* Grid of Profile Sections */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Personal Details */}
        <ProfileSection title="Personal Information" icon={User}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Title">{dash(p.title)}</DetailField>
            <DetailField label="Date of birth" icon={Calendar}>
              {dash(p.dateOfBirth)}
            </DetailField>
            <DetailField label="Gender">{dash(p.gender)}</DetailField>
            <DetailField label="Marital status">
              {dash(p.maritalStatus)}
            </DetailField>
            <DetailField label="Blood group">{dash(p.bloodGroup)}</DetailField>
            <DetailField label="Languages spoken">
              {p.languages.length > 0 ? p.languages.join(", ") : "—"}
            </DetailField>
          </dl>
        </ProfileSection>

        {/* Family Details */}
        <ProfileSection title="Family Details" icon={Users}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Father's name">
              {dash(p.fatherName)}
            </DetailField>
            <DetailField label="Mother's name">
              {dash(p.motherName)}
            </DetailField>
            <DetailField label="Spouse name">{dash(p.spouseName)}</DetailField>
          </dl>
        </ProfileSection>

        {/* Contact Information */}
        <ProfileSection
          title="Contact Details"
          icon={Mail}
          description="Maintained directly on the employee identity record"
          action={
            canEmployeeWrite ? (
              <Link
                href={`/hr/employees/${id}/edit`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
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
        <ProfileSection title="Emergency Contact" icon={Phone}>
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

        {/* Addresses */}
        <ProfileSection title="Residential Addresses" icon={Home}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AddressCard label="Current Address" value={p.presentAddress} />
            <AddressCard label="Permanent Address" value={p.permanentAddress} />
          </div>
        </ProfileSection>

        {/* Experience */}
        <ProfileSection title="Prior Work Experience" icon={Briefcase}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Fresher status">
              {p.isFresher ? "Yes" : "No"}
            </DetailField>
            <DetailField label="Total experience">
              {p.experienceYears !== null ? `${p.experienceYears} years` : "—"}
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
          icon={Building2}
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

        {/* Statutory & Bank Details (Full Width on XL) */}
        <div className="xl:col-span-2">
          <SensitiveSection id={id} canRead={canReadSensitive} />
        </div>
      </div>
    </div>
  );
}
