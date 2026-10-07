"use client";

import Link from "next/link";
import { useState } from "react";
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="break-words text-theme-sm text-gray-900 dark:text-white/90">
        {children}
      </dd>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function AddressBlock({
  label,
  value,
}: {
  label: string;
  value: ProfileAddress | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </h3>
      {value ? (
        <address className="break-words not-italic text-theme-sm text-gray-900 dark:text-white/90">
          {value.address}
          {value.area ? <>, {value.area}</> : null}
          {value.district ? <>, {value.district}</> : null}
          <br />
          {value.city}, {value.state} {value.pincode}
          {value.country ? <>, {value.country}</> : null}
        </address>
      ) : (
        <p className="text-theme-sm text-gray-900 dark:text-white/90">—</p>
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
      <Section title="Statutory and bank">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          You don&apos;t have access to statutory and bank details.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Statutory and bank"
      description="Each time these details are shown, the view is recorded in the audit log."
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-expanded={revealed}
        >
          {revealed ? "Hide details" : "Show details"}
        </Button>
      }
    >
      {!revealed ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          These details are hidden. Show them when you need to check a number.
        </p>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
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
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="PAN">{dash(query.data.panNumber)}</Field>
          <Field label="Aadhaar">{dash(query.data.aadhaarNumber)}</Field>
          <Field label="ESI number">{dash(query.data.esiNumber)}</Field>
          <Field label="PF number">{dash(query.data.pfNumber)}</Field>
          <Field label="Bank name">{dash(query.data.bankName)}</Field>
          <Field label="Branch">{dash(query.data.bankBranch)}</Field>
          <Field label="Account number">{dash(query.data.bankAccountNo)}</Field>
          <Field label="IFSC">{dash(query.data.bankIfsc)}</Field>
        </dl>
      )}
    </Section>
  );
}

/** Read-only profile for one employee. Name, contact and joining date come from the employee record. */
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card>
          <EmptyState
            title="Profile not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="text-brand-600 hover:underline"
              >
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
    <div className="flex min-w-0 flex-col gap-4">
      <Link
        href={`/hr/employees/${id}`}
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to employee
      </Link>

      <Card className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-theme-xl font-semibold text-gray-900 dark:text-white/90">
                {e.fullName}
              </h1>
              <StatusBadge
                label={titleCase(e.status)}
                colorToken={STATUS_COLOR[e.status] ?? "gray"}
              />
            </div>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {e.employeeCode}
              {p.updatedAt ? (
                <>
                  {" "}
                  · Last updated{" "}
                  {new Date(p.updatedAt).toLocaleDateString("en-IN")}
                </>
              ) : null}
            </p>
          </div>
          {canWrite ? (
            <Link
              href={`/hr/employees/${id}/profile/edit`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              Edit profile
            </Link>
          ) : null}
        </div>
      </Card>

      {!hasRecord ? (
        <Alert variant="info" title="No profile details yet">
          {canWrite
            ? "Personal, family, address and bank details have not been recorded. Use Edit profile to add them."
            : "Personal, family, address and bank details have not been recorded yet."}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Personal information">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title">{dash(p.title)}</Field>
            <Field label="Date of birth">{dash(p.dateOfBirth)}</Field>
            <Field label="Gender">{dash(p.gender)}</Field>
            <Field label="Marital status">{dash(p.maritalStatus)}</Field>
            <Field label="Blood group">{dash(p.bloodGroup)}</Field>
            <Field label="Languages">
              {p.languages.length > 0 ? p.languages.join(", ") : "—"}
            </Field>
          </dl>
        </Section>

        <Section title="Family details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Father's name">{dash(p.fatherName)}</Field>
            <Field label="Mother's name">{dash(p.motherName)}</Field>
            <Field label="Spouse name">{dash(p.spouseName)}</Field>
          </dl>
        </Section>

        <Section
          title="Contact information"
          description="Name, email and phone are maintained on the employee record."
          action={
            canEmployeeWrite ? (
              <Link
                href={`/hr/employees/${id}/edit`}
                className="text-theme-sm font-medium text-brand-600 hover:underline"
              >
                Edit contact
              </Link>
            ) : null
          }
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Work email">{dash(e.workEmail)}</Field>
            <Field label="Phone">{dash(e.phone)}</Field>
          </dl>
        </Section>

        <Section title="Emergency contact">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">{dash(p.emergencyContact.name)}</Field>
            <Field label="Phone">{dash(p.emergencyContact.phone)}</Field>
            <Field label="Relation">{dash(p.emergencyContact.relation)}</Field>
          </dl>
        </Section>

        <Section title="Addresses">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <AddressBlock label="Current address" value={p.presentAddress} />
            <AddressBlock
              label="Permanent address"
              value={p.permanentAddress}
            />
          </div>
        </Section>

        <Section title="Experience">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fresher">{p.isFresher ? "Yes" : "No"}</Field>
            <Field label="Total experience">
              {p.experienceYears !== null ? `${p.experienceYears} years` : "—"}
            </Field>
            <Field label="Previous company">{dash(p.previousCompany)}</Field>
            <Field label="Previous role">{dash(p.previousRole)}</Field>
          </dl>
        </Section>

        <Section title="Employment" description="From the employee record.">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee code">{e.employeeCode}</Field>
            <Field label="Date of joining">
              {e.dateOfJoining.slice(0, 10)}
            </Field>
            <Field label="Status">{titleCase(e.status)}</Field>
          </dl>
        </Section>

        <div className="xl:col-span-2">
          <SensitiveSection id={id} canRead={canReadSensitive} />
        </div>
      </div>
    </div>
  );
}
