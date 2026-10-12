"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import type { Contribution } from "../api";
import { describeError, isoDate, money, periodLabel } from "../format";
import {
  useComplianceProfile,
  useContributions,
  useSaveComplianceProfile,
} from "../hooks";
import { ESI_WRITE, PF_WRITE } from "../permissions";
import { esiProfileSchema, fieldErrors, pfProfileSchema } from "../schema";
import {
  CONTRIBUTION_PAYMENT_STATUSES,
  type ComplianceKind,
  type ContributionPaymentStatus,
  type EsiProfile,
  type PfProfile,
} from "../types";
import { ServerError } from "./DialogParts";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

/** Everything that differs between PF and ESI. */
const CONFIG = {
  pf: {
    name: "PF",
    long: "Provident Fund",
    write: PF_WRITE,
    applicableLabel: "PF applicable",
    idLabel: "UAN",
    idHint: "12-digit Universal Account Number.",
    wageLabel: "PF wage",
    rule: "Employee and employer each contribute 12% of the PF wage (Basic, capped at ₹15,000).",
  },
  esi: {
    name: "ESI",
    long: "Employee State Insurance",
    write: ESI_WRITE,
    applicableLabel: "ESI applicable",
    idLabel: "ESI (IP) number",
    idHint: "10- or 17-digit insurance number.",
    wageLabel: "ESI wage",
    rule: "Applies while the recurring monthly wage is ₹21,000 or less: employee 0.75%, employer 3.25%.",
  },
} as const;

interface FormState {
  applicable: boolean;
  idNumber: string;
  pfNumber: string;
  effectiveFrom: string;
  effectiveTo: string;
}

function initialForm(
  kind: ComplianceKind,
  profile: PfProfile | EsiProfile | null,
): FormState {
  if (!profile)
    return {
      applicable: true,
      idNumber: "",
      pfNumber: "",
      effectiveFrom: "",
      effectiveTo: "",
    };
  const pf = kind === "pf" ? (profile as PfProfile) : null;
  const esi = kind === "esi" ? (profile as EsiProfile) : null;
  return {
    applicable: pf ? pf.pfApplicable : Boolean(esi?.esiApplicable),
    idNumber: (pf ? pf.uan : esi?.insuranceNumber) ?? "",
    pfNumber: pf?.pfNumber ?? "",
    effectiveFrom: profile.effectiveFrom.slice(0, 10),
    effectiveTo: profile.effectiveTo?.slice(0, 10) ?? "",
  };
}

/** Create/update form for one employee's profile. Mounted with a `key` per
 * employee + saved version, so it always starts from the stored values. */
function ProfileForm({
  kind,
  employee,
  profile,
  canWrite,
}: {
  kind: ComplianceKind;
  employee: EmployeeOption;
  profile: PfProfile | EsiProfile | null;
  canWrite: boolean;
}) {
  const cfg = CONFIG[kind];
  const [form, setForm] = useState(() => initialForm(kind, profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const save = useSaveComplianceProfile(kind);
  const { toast } = useToast();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed =
      kind === "pf"
        ? pfProfileSchema.safeParse({
            pfApplicable: form.applicable,
            uan: form.idNumber,
            pfNumber: form.pfNumber,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo,
          })
        : esiProfileSchema.safeParse({
            esiApplicable: form.applicable,
            insuranceNumber: form.idNumber,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo,
          });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      // Both schemas' ID field shows under the one "idNumber" input.
      setErrors({
        ...errs,
        idNumber: errs.uan ?? errs.insuranceNumber ?? "",
      });
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await save.mutateAsync({ employeeId: employee.id, body: parsed.data });
      toast({
        title: `${cfg.name} profile saved for ${employee.fullName}`,
        variant: "success",
      });
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  const disabled = !canWrite || save.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={`${cfg.name} profile for ${employee.fullName}`}
      className="flex flex-col gap-4"
    >
      {profile ? (
        <p className="text-theme-xs text-gray-600 dark:text-gray-400">
          Last updated {isoDate(profile.updatedAt)}.
        </p>
      ) : (
        <Alert variant="info" title={`No ${cfg.name} profile yet`}>
          {canWrite
            ? `Fill in the form to register ${employee.fullName} for ${cfg.name}.`
            : `${employee.fullName} is not registered for ${cfg.name}.`}
        </Alert>
      )}
      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
        <Checkbox
          checked={form.applicable}
          disabled={disabled}
          onChange={(e) => set("applicable", e.target.checked)}
        />
        {cfg.applicableLabel}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={cfg.idLabel}
          hint={cfg.idHint}
          error={errors.idNumber || undefined}
        >
          {(f) => (
            <Input
              {...f}
              inputMode="numeric"
              value={form.idNumber}
              disabled={disabled}
              onChange={(e) => set("idNumber", e.target.value)}
            />
          )}
        </FormField>
        {kind === "pf" ? (
          <FormField label="PF number" error={errors.pfNumber}>
            {(f) => (
              <Input
                {...f}
                value={form.pfNumber}
                disabled={disabled}
                onChange={(e) => set("pfNumber", e.target.value)}
              />
            )}
          </FormField>
        ) : null}
        <FormField
          label="Effective from"
          hint={profile ? undefined : "Optional. Defaults to today."}
          error={errors.effectiveFrom}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={form.effectiveFrom}
              disabled={disabled}
              onChange={(e) => set("effectiveFrom", e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Effective to"
          hint="Optional."
          error={errors.effectiveTo}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={form.effectiveTo}
              disabled={disabled}
              onChange={(e) => set("effectiveTo", e.target.value)}
            />
          )}
        </FormField>
      </div>
      <ServerError message={serverError} />
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            Save {cfg.name} profile
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function ProfileSection({ kind }: { kind: ComplianceKind }) {
  const cfg = CONFIG[kind];
  const canWrite = usePermission(cfg.write);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const profile = useComplianceProfile(kind, employee?.id ?? null);

  return (
    <Card>
      <section
        aria-labelledby={`${kind}-profile-heading`}
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id={`${kind}-profile-heading`}
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            {cfg.name} registration
          </h2>
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            {cfg.rule}
          </p>
        </div>
        <div className="max-w-md">
          <FormField label="Employee">
            {(f) => (
              <EmployeePicker {...f} value={employee} onChange={setEmployee} />
            )}
          </FormField>
        </div>
        {employee ? (
          <>
            <QueryState query={profile} area={`this ${cfg.name} profile`} />
            {profile.isSuccess ? (
              <ProfileForm
                key={`${employee.id}-${profile.data?.updatedAt ?? "new"}`}
                kind={kind}
                employee={employee}
                profile={profile.data}
                canWrite={canWrite}
              />
            ) : null}
          </>
        ) : (
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            Choose an employee to see or edit their {cfg.name} registration.
          </p>
        )}
      </section>
    </Card>
  );
}

function ContributionsSection({ kind }: { kind: ComplianceKind }) {
  const cfg = CONFIG[kind];
  const [page, setPage] = useState(1);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [status, setStatus] = useState<ContributionPaymentStatus | "">("");
  const query = useContributions(kind, {
    page,
    limit: PAGE_SIZE,
    ...(periodId ? { payrollPeriodId: periodId } : {}),
    ...(status ? { paymentStatus: status } : {}),
  });
  const rows = (query.data?.data ?? []) as Contribution<ComplianceKind>[];

  const included = (r: Contribution<ComplianceKind>) =>
    "pfIncluded" in r ? r.pfIncluded : r.esiIncluded;
  const wage = (r: Contribution<ComplianceKind>) =>
    "pfWage" in r ? r.pfWage : r.esiWage;

  return (
    <section
      aria-labelledby={`${kind}-contrib-heading`}
      className="flex flex-col gap-3"
    >
      <h2
        id={`${kind}-contrib-heading`}
        className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
      >
        {cfg.name} contributions
      </h2>
      <p className="text-theme-sm text-gray-600 dark:text-gray-400">
        Created by payroll runs; read-only here.
      </p>
      <Card>
        <div className="flex flex-wrap gap-3">
          <PeriodFilterSelect
            value={periodId}
            onChange={(id) => {
              setPeriodId(id);
              setPage(1);
            }}
          />
          <Select
            aria-label="Filter by payment status"
            className="w-full sm:w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ContributionPaymentStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {CONTRIBUTION_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      <QueryState query={query} area={`${cfg.name} contributions`} />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title={`No ${cfg.name} contributions`}
            description="Contributions appear here once payroll is run for a period."
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<Contribution<ComplianceKind>>
            caption={`${cfg.name} contributions`}
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.employee.fullName}</span>
                    <span className="text-theme-xs text-gray-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
              { header: "Period", cell: (r) => periodLabel(r.payrollPeriod) },
              {
                header: "Covered",
                cell: (r) => (included(r) ? "Yes" : "No"),
              },
              {
                header: cfg.wageLabel,
                cell: (r) => money(wage(r)),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Employee share",
                cell: (r) => money(r.employeeContribution),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Employer share",
                cell: (r) => money(r.employerContribution),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Payment",
                cell: (r) => <StatusPill status={r.paymentStatus} />,
              },
              {
                header: "Salary credited",
                cell: (r) => (r.salaryCredited ? "Yes" : "No"),
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </section>
  );
}

/** HR → Compliance → PF / ESI: one employee's registration, plus the
 * contributions payroll runs produced. */
export function CompliancePanel({ kind }: { kind: ComplianceKind }) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileSection kind={kind} />
      <ContributionsSection kind={kind} />
    </div>
  );
}
