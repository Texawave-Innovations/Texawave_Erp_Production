"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
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
import { downloadPayslipPdf } from "../api";
import { downloadBlob } from "../download";
import { days, describeError, isoDate, money, periodLabel } from "../format";
import {
  useGeneratePayslips,
  useMyPayslips,
  usePayslips,
  usePeriods,
} from "../hooks";
import { MY_PAYSLIP_READ, PAYROLL_WRITE, PAYSLIP_READ } from "../permissions";
import type { Payslip } from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

const SOURCE_LABEL: Record<string, string> = {
  PF: "Provident Fund",
  ESI: "ESI",
  LOAN: "Loan EMI",
};

// ---- download -------------------------------------------------------------

/** Fetches the PDF with the caller's token and saves it. The API renders it
 * with a headless browser, so it can take a moment — the button shows that. */
function DownloadPdfButton({
  payslip,
  selfService,
  size = "sm",
}: {
  payslip: Payslip;
  selfService: boolean;
  size?: "sm" | "md";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const pdf = await downloadPayslipPdf(payslip.id, selfService);
      downloadBlob(`${payslip.payslipNumber}.pdf`, pdf);
    } catch (err) {
      toast({
        title: "Could not download the payslip",
        description: describeError(err),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size={size}
      variant="secondary"
      loading={busy}
      aria-label={`Download PDF of payslip ${payslip.payslipNumber}`}
      onClick={() => void handleClick()}
    >
      Download PDF
    </Button>
  );
}

// ---- detail ---------------------------------------------------------------

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
        {value}
      </dd>
    </div>
  );
}

/** One payslip as issued: the list row already carries every field, so this
 * needs no extra request. Bank account and PAN arrive masked from the API. */
function PayslipDetailDialog({
  payslip: p,
  selfService,
  onClose,
}: {
  payslip: Payslip;
  selfService: boolean;
  onClose: () => void;
}) {
  const bank = p.employee.bankDetails;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Payslip ${p.payslipNumber}`}
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          {p.employee.fullName} ({p.employee.employeeCode}) ·{" "}
          {periodLabel(p.payrollPeriod)} · issued {isoDate(p.generatedAt)}
        </p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact
            label="Designation"
            value={p.employee.designation?.name ?? "—"}
          />
          <Fact label="Department" value={p.employee.department?.name ?? "—"} />
          <Fact label="Payable days" value={days(p.payrollEntry.payableDays)} />
          <Fact label="Loss of pay" value={days(p.payrollEntry.lopDays)} />
          <Fact
            label="Bank"
            value={bank ? `${bank.bankName} · ${bank.accountNumber}` : "—"}
          />
          <Fact label="PAN" value={bank?.panNumber ?? "—"} />
          <Fact label="UAN" value={p.employee.pfProfile?.uan ?? "—"} />
          <Fact
            label="ESI number"
            value={p.employee.esiProfile?.insuranceNumber ?? "—"}
          />
        </dl>

        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            caption="Earnings"
            rows={p.payrollEntry.earnings}
            getRowKey={(r) => r.code}
            columns={[
              { header: "Earning", cell: (r) => r.name },
              {
                header: "Amount",
                cell: (r) => money(r.calculatedAmount),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
            ]}
          />
          {p.payrollEntry.deductions.length > 0 ? (
            <DataTable
              caption="Deductions"
              rows={p.payrollEntry.deductions}
              getRowKey={(r) => r.code}
              columns={[
                {
                  header: "Deduction",
                  cell: (r) =>
                    r.sourceType && SOURCE_LABEL[r.sourceType]
                      ? `${r.name} (${SOURCE_LABEL[r.sourceType]})`
                      : r.name,
                },
                {
                  header: "Amount",
                  cell: (r) => money(r.amount),
                  className: "text-right whitespace-nowrap",
                  headerClassName: "text-right",
                },
              ]}
            />
          ) : (
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">
              No deductions.
            </p>
          )}
        </div>

        <dl className="grid gap-2 sm:grid-cols-3">
          <Fact
            label="Gross earnings"
            value={money(p.payrollEntry.totalGrossEarnings)}
          />
          <Fact
            label="Total deductions"
            value={money(p.payrollEntry.totalDeductions)}
          />
          <Fact
            label="Net pay"
            value={<span className="text-theme-md">{money(p.netPayable)}</span>}
          />
        </dl>

        <div className="flex justify-end gap-2">
          <DownloadPdfButton payslip={p} selfService={selfService} size="md" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---- table ----------------------------------------------------------------

function PayslipsTable({
  caption,
  rows,
  selfService,
  onOpen,
}: {
  caption: string;
  rows: Payslip[];
  selfService: boolean;
  onOpen: (p: Payslip) => void;
}) {
  return (
    <DataTable<Payslip>
      caption={caption}
      rows={rows}
      getRowKey={(r) => String(r.id)}
      columns={[
        { header: "Payslip", cell: (r) => r.payslipNumber },
        ...(selfService
          ? []
          : [
              {
                header: "Employee",
                cell: (r: Payslip) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.employee.fullName}</span>
                    <span className="text-theme-xs text-gray-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
            ]),
        { header: "Period", cell: (r) => periodLabel(r.payrollPeriod) },
        {
          header: "Net pay",
          cell: (r) => money(r.netPayable),
          className: "text-right whitespace-nowrap",
          headerClassName: "text-right",
        },
        { header: "Issued", cell: (r) => isoDate(r.generatedAt) },
        {
          header: "Actions",
          cell: (r) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`View payslip ${r.payslipNumber}`}
                onClick={() => onOpen(r)}
              >
                View
              </Button>
              <DownloadPdfButton payslip={r} selfService={selfService} />
            </div>
          ),
        },
      ]}
    />
  );
}

// ---- generate -------------------------------------------------------------

/** Payslips come from a period's approved run. Finalizing a period already
 * issues them; this re-issues them (e.g. after bank details changed). */
function GeneratePayslipsDialog({ onClose }: { onClose: () => void }) {
  const generate = useGeneratePayslips();
  const periods = usePeriods({ page: 1, limit: 100 });
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const ready = (periods.data?.data ?? []).filter(
    (p) => p.status === "APPROVED" || p.status === "FINALIZED",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId) {
      setError("Choose a payroll period");
      return;
    }
    setError(undefined);
    setServerError(null);
    try {
      const rows = await generate.mutateAsync(periodId);
      toast({
        title: `${rows.length} payslip${rows.length === 1 ? "" : "s"} generated`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Generate payslips">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Payroll period"
          required
          error={error}
          hint="Only periods with an approved run. Existing payslips are refreshed, not duplicated."
        >
          {(f) => (
            <Select
              {...f}
              disabled={periods.isPending}
              value={periodId ?? ""}
              onChange={(e) =>
                setPeriodId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">
                {periods.isPending
                  ? "Loading periods…"
                  : periods.isError
                    ? "Could not load periods"
                    : ready.length === 0
                      ? "No period has an approved run yet"
                      : "Choose a period"}
              </option>
              {ready.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={generate.isPending}
          submitLabel="Generate"
        />
      </form>
    </Dialog>
  );
}

// ---- sections -------------------------------------------------------------

/** The signed-in employee's own payslips. Hidden for an account with no
 * employee record, as the other "My …" sections are. */
function MyPayslipsSection() {
  const canRead = usePermission(MY_PAYSLIP_READ);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Payslip | null>(null);
  const query = useMyPayslips({ page, limit: PAGE_SIZE }, canRead);
  const rows = query.data?.data ?? [];

  if (!canRead) return null;
  if (
    query.error instanceof ApiError &&
    query.error.errorCode === "NOT_AN_EMPLOYEE"
  )
    return null;

  return (
    <section
      aria-labelledby="my-payslips-heading"
      className="flex flex-col gap-3"
    >
      <h2
        id="my-payslips-heading"
        className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
      >
        My payslips
      </h2>
      <QueryState query={query} area="your payslips" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No payslips yet"
            description="Your payslip appears here once a payroll period is finalized."
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <PayslipsTable
            caption="My payslips"
            rows={rows}
            selfService
            onOpen={setOpen}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      {open ? (
        <PayslipDetailDialog
          payslip={open}
          selfService
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

function HrPayslipsSection() {
  const canRead = usePermission(PAYSLIP_READ);
  const canGenerate = usePermission(PAYROLL_WRITE);
  const [page, setPage] = useState(1);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [generating, setGenerating] = useState(false);
  const query = usePayslips(
    {
      page,
      limit: PAGE_SIZE,
      ...(periodId ? { payrollPeriodId: periodId } : {}),
      ...(employee ? { employeeId: employee.id } : {}),
    },
    canRead,
  );
  const rows = query.data?.data ?? [];
  const filtered = Boolean(periodId || employee);

  if (!canRead) return null;

  return (
    <section
      aria-labelledby="hr-payslips-heading"
      className="flex flex-col gap-3"
    >
      <h2
        id="hr-payslips-heading"
        className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
      >
        Employee payslips
      </h2>
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
            <div className="w-full sm:w-64">
              <FormField label="Filter by employee">
                {(f) => (
                  <EmployeePicker
                    {...f}
                    value={employee}
                    onChange={(e) => {
                      setEmployee(e);
                      setPage(1);
                    }}
                  />
                )}
              </FormField>
            </div>
          </div>
          {canGenerate ? (
            <Button onClick={() => setGenerating(true)}>
              Generate payslips
            </Button>
          ) : null}
        </div>
      </Card>
      <QueryState query={query} area="payslips" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No payslips"
            description={
              filtered
                ? "No payslips match these filters."
                : "Payslips are issued when a payroll period is finalized."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <PayslipsTable
            caption="Employee payslips"
            rows={rows}
            selfService={false}
            onOpen={setOpen}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      {open ? (
        <PayslipDetailDialog
          payslip={open}
          selfService={false}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {generating ? (
        <GeneratePayslipsDialog onClose={() => setGenerating(false)} />
      ) : null}
    </section>
  );
}

/** HR → Payroll → Payslips: the employee's own payslips, then (with
 * hr.payslip.read) everyone's in the caller's scope. */
export function PayslipsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <MyPayslipsSection />
      <HrPayslipsSection />
    </div>
  );
}
