"use client";

import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  describeError,
  money,
  recentFinancialYears,
  timestamp,
} from "../format";
import {
  useSaveDeclarationForEmployee,
  useTaxDeclarations,
  useVerifyDeclaration,
} from "../hooks";
import {
  TAX_DECLARATION_APPROVE,
  TAX_DECLARATION_READ,
  TAX_DECLARATION_WRITE,
} from "../permissions";
import {
  DECLARATION_FIELDS,
  DECLARATION_STATUSES,
  type DeclarationStatus,
  type TaxDeclaration,
  VERIFIABLE_FIELDS,
  type VerifiedField,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";
import {
  DeclarationFields,
  declarationAmounts,
  declarationDraft,
  Form16View,
} from "./TaxDeclarationParts";

const PAGE_SIZE = 20;

/** HR checks a submitted declaration against the proofs and records the
 * amounts it accepts (default: as declared). Never one's own. */
function VerifyDialog({
  declaration: d,
  onClose,
}: {
  declaration: TaxDeclaration;
  onClose: () => void;
}) {
  const verify = useVerifyDeclaration();
  const { toast } = useToast();
  const [accepted, setAccepted] = useState<Record<VerifiedField, string>>(
    () => {
      const out = {} as Record<VerifiedField, string>;
      for (const [declared, field] of VERIFIABLE_FIELDS)
        out[field] = String(Number(d[declared]));
      return out;
    },
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const label = (declared: string) =>
    DECLARATION_FIELDS.find(([k]) => k === declared)?.[1] ?? declared;

  async function run(decision: "VERIFIED" | "REJECTED") {
    if (decision === "REJECTED" && note.trim().length < 3) {
      setError("Give a note when rejecting (at least 3 characters).");
      return;
    }
    const body: Partial<Record<VerifiedField, number>> = {};
    for (const [, field] of VERIFIABLE_FIELDS) {
      const n = Number(accepted[field]);
      if (!Number.isFinite(n) || n < 0) {
        setError("Accepted amounts must be ₹0 or more");
        return;
      }
      body[field] = n;
    }
    setError(null);
    try {
      await verify.mutateAsync({
        id: d.id,
        body: {
          decision,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(decision === "VERIFIED" ? body : {}),
        },
      });
      toast({
        title:
          decision === "VERIFIED"
            ? "Declaration verified"
            : "Declaration rejected",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Verify ${d.employee.fullName} — FY ${d.financialYear}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          {d.regime} regime. Other income {money(d.otherIncome)} · previous
          employer {money(d.previousEmployerIncome)} (TDS{" "}
          {money(d.previousEmployerTds)}).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {VERIFIABLE_FIELDS.map(([declared, field]) => (
            <FormField
              key={field}
              label={`${label(declared)} — accepted`}
              hint={`Declared ${money(d[declared])}`}
            >
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={accepted[field]}
                  onChange={(e) =>
                    setAccepted((a) => ({ ...a, [field]: e.target.value }))
                  }
                />
              )}
            </FormField>
          ))}
        </div>
        <FormField label="Note" hint="Required when rejecting.">
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={error} />
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={verify.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={verify.isPending}
            onClick={() => void run("REJECTED")}
          >
            Reject
          </Button>
          <Button
            loading={verify.isPending}
            onClick={() => void run("VERIFIED")}
          >
            Verify
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Enter or correct a declaration on an employee's behalf (write scope). */
function OnBehalfDialog({
  financialYear,
  existing,
  onClose,
}: {
  financialYear: string;
  existing: TaxDeclaration | null;
  onClose: () => void;
}) {
  const save = useSaveDeclarationForEmployee();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(
    existing
      ? ({
          id: existing.employee.id,
          fullName: existing.employee.fullName,
          employeeCode: existing.employee.employeeCode,
        } as EmployeeOption)
      : null,
  );
  const [draft, setDraft] = useState(() => declarationDraft(existing));
  const [submit, setSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return setError("Choose an employee");
    const parsed = declarationAmounts(draft);
    if ("error" in parsed) return setError(parsed.error);
    setError(null);
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        financialYear,
        body: {
          version: existing?.version ?? 0,
          regime: draft.regime,
          ...parsed.amounts,
          submit,
        },
      });
      toast({
        title: submit ? "Declaration submitted" : "Declaration saved",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Declaration on behalf — FY ${financialYear}`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required>
          {(f) => (
            <EmployeePicker
              {...f}
              value={employee}
              onChange={setEmployee}
              disabled={Boolean(existing)}
            />
          )}
        </FormField>
        <DeclarationFields draft={draft} onChange={setDraft} />
        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={submit}
            onChange={(e) => setSubmit(e.target.checked)}
          />
          Submit for verification (otherwise saved as a draft)
        </label>
        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel="Save declaration"
        />
      </form>
    </Dialog>
  );
}

function Form16Dialog({
  financialYear,
  employee,
  onClose,
}: {
  financialYear: string;
  employee: { id: number; fullName: string };
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Form 16 — ${employee.fullName}, FY ${financialYear}`}
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <Form16View financialYear={financialYear} employeeId={employee.id} />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** HR → Payroll → Tax declarations (Docs/PAYROLL_AND_COMPLIANCE.md §4.13,
 * §4.14). Team-scoped: rows, verification and on-behalf entry stay inside
 * the caller's teams. */
export function TaxDeclarationsPanel() {
  const canRead = usePermission(TAX_DECLARATION_READ);
  const canWrite = usePermission(TAX_DECLARATION_WRITE);
  const canApprove = usePermission(TAX_DECLARATION_APPROVE);
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const years = recentFinancialYears(4);
  const [financialYear, setFinancialYear] = useState(years[0] ?? "");
  const [status, setStatus] = useState<DeclarationStatus | "">(
    canApprove ? "SUBMITTED" : "",
  );
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState<TaxDeclaration | null>(null);
  const [onBehalf, setOnBehalf] = useState<{
    existing: TaxDeclaration | null;
  } | null>(null);
  const [form16, setForm16] = useState<{ id: number; fullName: string } | null>(
    null,
  );
  const [form16Employee, setForm16Employee] = useState<EmployeeOption | null>(
    null,
  );
  const query = useTaxDeclarations(
    {
      page,
      limit: PAGE_SIZE,
      financialYear,
      ...(status ? { status } : {}),
    },
    canRead,
  );
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Financial year">
              {(f) => (
                <Select
                  {...f}
                  className="w-36"
                  value={financialYear}
                  onChange={(e) => {
                    setFinancialYear(e.target.value);
                    setPage(1);
                  }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Status">
              {(f) => (
                <Select
                  {...f}
                  className="w-40"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as DeclarationStatus | "");
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  {DECLARATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          {canWrite ? (
            <Button onClick={() => setOnBehalf({ existing: null })}>
              Declaration on behalf
            </Button>
          ) : null}
        </div>
      </Card>

      <QueryState query={query} area="tax declarations" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No declarations"
            description={
              status === "SUBMITTED"
                ? "Nothing waits for verification."
                : "No declarations match these filters."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<TaxDeclaration>
            caption="Tax declarations"
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
              { header: "Regime", cell: (r) => r.regime },
              {
                header: "80C · 80D · HRA",
                cell: (r) =>
                  `${money(r.section80c)} · ${money(r.section80d)} · ${money(r.hraExemption)}`,
              },
              {
                header: "Status",
                cell: (r) => (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusPill status={r.status} />
                    {r.verifier ? (
                      <span className="text-theme-xs text-gray-500">
                        by {r.verifier.fullName} · {timestamp(r.verifiedAt)}
                      </span>
                    ) : null}
                    {r.verificationNote ? (
                      <span className="text-theme-xs text-gray-500">
                        {r.verificationNote}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex flex-wrap gap-2">
                    {canApprove && r.status === "SUBMITTED" ? (
                      r.employee.userId === userId ? (
                        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                          Your own — someone else must verify
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setVerifying(r)}>
                          Verify
                        </Button>
                      )
                    ) : null}
                    {canWrite &&
                    (r.status === "DRAFT" || r.status === "REJECTED") ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setOnBehalf({ existing: r })}
                      >
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm16({
                          id: r.employee.id,
                          fullName: r.employee.fullName,
                        })
                      }
                    >
                      Form 16
                    </Button>
                  </div>
                ),
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

      {canRead ? (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <FormField label="Form 16 of any employee in your scope">
                {(f) => (
                  <EmployeePicker
                    {...f}
                    value={form16Employee}
                    onChange={setForm16Employee}
                  />
                )}
              </FormField>
            </div>
            <Button
              variant="secondary"
              disabled={!form16Employee}
              onClick={() =>
                form16Employee &&
                setForm16({
                  id: form16Employee.id,
                  fullName: form16Employee.fullName,
                })
              }
            >
              Open Form 16
            </Button>
          </div>
        </Card>
      ) : null}

      {verifying ? (
        <VerifyDialog
          declaration={verifying}
          onClose={() => setVerifying(null)}
        />
      ) : null}
      {onBehalf ? (
        <OnBehalfDialog
          financialYear={financialYear}
          existing={onBehalf.existing}
          onClose={() => setOnBehalf(null)}
        />
      ) : null}
      {form16 ? (
        <Form16Dialog
          financialYear={financialYear}
          employee={form16}
          onClose={() => setForm16(null)}
        />
      ) : null}
    </div>
  );
}
