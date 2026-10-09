"use client";

import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { exportPaymentBatch } from "../api";
import { downloadText } from "../download";
import { describeError, isoDate, money, periodLabel } from "../format";
import {
  useCreatePaymentBatch,
  usePaymentBatch,
  usePaymentBatches,
  usePeriods,
  useProcessPaymentBatch,
  useUpdatePayment,
} from "../hooks";
import { PAYMENT_WRITE } from "../permissions";
import {
  BATCH_STATUSES,
  type BatchStatus,
  PAYMENT_METHODS,
  PAYMENT_TRANSITIONS,
  type PaymentBatch,
  type PaymentMethod,
  type PaymentStatus,
  type PayrollPayment,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

const METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
};

// ---- create ---------------------------------------------------------------

/** One batch pays a finalized period's approved run. Bank transfer needs
 * every employee's bank details; the API names anyone missing them. */
function NewBatchDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const create = useCreatePaymentBatch();
  const periods = usePeriods({ page: 1, limit: 100 });
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const finalized = (periods.data?.data ?? []).filter(
    (p) => p.status === "FINALIZED",
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
      const batch = await create.mutateAsync({
        payrollPeriodId: periodId,
        paymentMethod: method,
      });
      toast({
        title: `Payment batch ${batch.batchNumber} created`,
        variant: "success",
      });
      onCreated(batch.id);
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="New payment batch">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Payroll period"
          required
          error={error}
          hint="Only finalized periods can be paid. One batch per period."
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
                    : finalized.length === 0
                      ? "No finalized period yet"
                      : "Choose a period"}
              </option>
              {finalized.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Payment method" required>
          {(f) => (
            <Select
              {...f}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Create batch"
        />
      </form>
    </Dialog>
  );
}

// ---- one payment ----------------------------------------------------------

/** Inline (not a second dialog) correction of one payment: its status, as
 * far as the API's transitions allow, and the bank's reference. */
function PaymentEditor({
  payment,
  onDone,
}: {
  payment: PayrollPayment;
  onDone: () => void;
}) {
  const update = useUpdatePayment();
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [reference, setReference] = useState(payment.bankReference ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const choices = [payment.status, ...PAYMENT_TRANSITIONS[payment.status]];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const ref = reference.trim();
    try {
      await update.mutateAsync({
        id: payment.id,
        body: {
          ...(status !== payment.status ? { status } : {}),
          ...(ref !== (payment.bankReference ?? "")
            ? { bankReference: ref }
            : {}),
        },
      });
      toast({
        title: `Payment for ${payment.employee.fullName} updated`,
        variant: "success",
      });
      onDone();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Update payment for ${payment.employee.fullName}`}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      noValidate
    >
      <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
        {payment.employee.fullName} · {money(payment.amount)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Status">
          {(f) => (
            <Select
              {...f}
              value={status}
              onChange={(e) => setStatus(e.target.value as PaymentStatus)}
            >
              {choices.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Bank reference" hint="e.g. the UTR number.">
          {(f) => (
            <Input
              {...f}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <ServerError message={serverError} />
      <DialogActions
        onCancel={onDone}
        submitting={update.isPending}
        submitLabel="Save payment"
      />
    </form>
  );
}

// ---- batch detail ---------------------------------------------------------

function BatchDetailDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const canWrite = usePermission(PAYMENT_WRITE);
  const query = usePaymentBatch(id);
  const process = useProcessPaymentBatch();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const batch = query.data;
  const payments = batch?.payments ?? [];
  const editing = payments.find((p) => p.id === editingId) ?? null;

  async function handleProcess() {
    setActionError(null);
    try {
      await process.mutateAsync(id);
      toast({
        title: "Batch processed — payments marked paid",
        variant: "success",
      });
      setConfirming(false);
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  async function handleExport() {
    setActionError(null);
    setExporting(true);
    try {
      const file = await exportPaymentBatch(id);
      downloadText(file.fileName, file.content);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={batch ? `Payment batch ${batch.batchNumber}` : "Payment batch"}
      className="max-w-5xl"
    >
      <div className="flex flex-col gap-4">
        <QueryState query={query} area="this payment batch" />
        {batch ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
                <StatusPill status={batch.status} />
                {periodLabel(batch.payrollPeriod)} · {batch.totalEmployees}{" "}
                employee{batch.totalEmployees === 1 ? "" : "s"} ·{" "}
                <strong>{money(batch.totalAmount)}</strong>
                {batch.processedAt
                  ? ` · processed ${isoDate(batch.processedAt)}`
                  : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  loading={exporting}
                  onClick={() => void handleExport()}
                >
                  Export bank file
                </Button>
                {canWrite && batch.status === "PENDING" && !confirming ? (
                  <Button onClick={() => setConfirming(true)}>
                    Process batch
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-theme-xs text-gray-600 dark:text-gray-400">
              The bank file holds full account numbers — store and share it like
              any other bank document.
            </p>
            {confirming ? (
              <Alert variant="warning" title="Process this batch?">
                <div className="flex flex-col gap-3">
                  <span>
                    Every payment still pending is marked paid today. Do this
                    after the bank has accepted the transfer file. It cannot be
                    undone; correct a single payment afterwards if needed.
                  </span>
                  <div className="flex gap-2">
                    <Button
                      loading={process.isPending}
                      onClick={() => void handleProcess()}
                    >
                      Yes, process batch
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={process.isPending}
                      onClick={() => setConfirming(false)}
                    >
                      Not yet
                    </Button>
                  </div>
                </div>
              </Alert>
            ) : null}
            <ServerError message={actionError} />

            {payments.length === 0 ? (
              <EmptyState
                title="No payments"
                description="This batch has no payments."
              />
            ) : (
              <DataTable<PayrollPayment>
                caption="Payments"
                rows={payments}
                getRowKey={(r) => String(r.id)}
                columns={[
                  {
                    header: "Employee",
                    cell: (r) => (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {r.employee.fullName}
                        </span>
                        <span className="text-theme-xs text-gray-500">
                          {r.employee.employeeCode}
                        </span>
                      </div>
                    ),
                  },
                  {
                    header: "Bank",
                    cell: (r) =>
                      r.employee.bankDetails
                        ? `${r.employee.bankDetails.bankName} · ${r.employee.bankDetails.accountNumber}`
                        : "—",
                  },
                  {
                    header: "Amount",
                    cell: (r) => money(r.amount),
                    className: "text-right whitespace-nowrap",
                    headerClassName: "text-right",
                  },
                  {
                    header: "Method",
                    cell: (r) => METHOD_LABEL[r.paymentMethod],
                  },
                  {
                    header: "Status",
                    cell: (r) => <StatusPill status={r.status} />,
                  },
                  { header: "Reference", cell: (r) => r.bankReference ?? "—" },
                  { header: "Credited", cell: (r) => isoDate(r.creditedAt) },
                  {
                    header: "Actions",
                    cell: (r) =>
                      canWrite && PAYMENT_TRANSITIONS[r.status].length > 0 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Update payment for ${r.employee.fullName}`}
                          onClick={() => setEditingId(r.id)}
                        >
                          Update
                        </Button>
                      ) : null,
                  },
                ]}
              />
            )}
            {editing ? (
              <PaymentEditor
                key={editing.id}
                payment={editing}
                onDone={() => setEditingId(null)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

// ---- list -----------------------------------------------------------------

/** HR → Payroll → Payments: pay a finalized period in one batch, export the
 * bank file, mark it processed, and correct single payments. Batches cover
 * the whole organization, so the API requires an `.all` grant to see them. */
export function PaymentsPanel() {
  const canWrite = usePermission(PAYMENT_WRITE);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const query = usePaymentBatches({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(periodId ? { payrollPeriodId: periodId } : {}),
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Select
              aria-label="Filter by batch status"
              className="w-44"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as BatchStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {BATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
          </div>
          {canWrite ? (
            <Button onClick={() => setCreating(true)}>New payment batch</Button>
          ) : null}
        </div>
      </Card>

      <QueryState query={query} area="payment batches" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No payment batches"
            description={
              status || periodId
                ? "No batches match these filters."
                : "Create a batch once a payroll period is finalized."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<PaymentBatch>
            caption="Payment batches"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Batch", cell: (r) => r.batchNumber },
              { header: "Period", cell: (r) => periodLabel(r.payrollPeriod) },
              {
                header: "Employees",
                cell: (r) => r.totalEmployees,
                className: "text-right",
                headerClassName: "text-right",
              },
              {
                header: "Total",
                cell: (r) => money(r.totalAmount),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Status",
                cell: (r) => <StatusPill status={r.status} />,
              },
              {
                header: "Created",
                cell: (r) =>
                  `${isoDate(r.generatedAt)}${r.generator ? ` · ${r.generator.fullName}` : ""}`,
              },
              {
                header: "Actions",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Open batch ${r.batchNumber}`}
                    onClick={() => setOpenId(r.id)}
                  >
                    Open
                  </Button>
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

      {creating ? (
        <NewBatchDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      ) : null}
      {openId ? (
        <BatchDetailDialog id={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}
