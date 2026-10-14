"use client";

import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { downloadPayrollReport } from "../api";
import { downloadBlob } from "../download";
import { describeError, periodLabel, timestamp } from "../format";
import { useReopenPeriod } from "../hooks";
import { PAYROLL_EXPORT } from "../permissions";
import {
  PAYROLL_REPORTS,
  type PayrollPeriod,
  type PayrollReportId,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";

const MIN_REASON = 10;

/**
 * Reopen a finalized month (Docs/PAYROLL_AND_COMPLIANCE.md §5.2). The API
 * refuses it once salary is paid or PF/ESI is remitted; it undoes what
 * finalize settled and sends the run back for a fresh approval.
 */
export function ReopenPeriodDialog({
  period,
  onClose,
}: {
  period: PayrollPeriod;
  onClose: () => void;
}) {
  const reopen = useReopenPeriod();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const label = periodLabel(period);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setError(`Give a reason of at least ${MIN_REASON} characters`);
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await reopen.mutateAsync({ id: period.id, reason: reason.trim() });
      toast({
        title: `${label} reopened — the run needs a fresh approval`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Reopen period">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          Reopen <strong>{label}</strong>? Loan EMIs, bonuses and arrears it
          settled become due again, unpaid payment batches are cancelled, and
          the run goes back for approval by a second person. Re-finalizing
          issues a new version of any payslip that changes. Not possible once
          salary is paid or PF/ESI is remitted.
        </p>
        <FormField
          label="Reason"
          required
          hint="Kept on the period and in the audit trail."
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={reopen.isPending}
          submitLabel="Reopen"
          destructive
        />
      </form>
    </Dialog>
  );
}

/** The last reopen of a period, when there was one. */
export function ReopenedNotice({ period }: { period: PayrollPeriod }) {
  if (!period.reopenCount || !period.reopenReason) return null;
  return (
    <Alert variant="warning" title={`Reopened ${period.reopenCount} time(s)`}>
      Last on {timestamp(period.reopenedAt)}: {period.reopenReason}
    </Alert>
  );
}

/**
 * Statutory files and reports of a period (§4.15), organization-wide
 * (`hr.payroll.export.all`). ECR, ESI, PT and TDS only once FINALIZED; the
 * journal and register from the approved run.
 */
export function PeriodReportsSection({
  period,
  hasApprovedRun,
}: {
  period: PayrollPeriod;
  hasApprovedRun: boolean;
}) {
  const canExport = usePermission(PAYROLL_EXPORT);
  const [busy, setBusy] = useState<PayrollReportId | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canExport || !hasApprovedRun) return null;
  const finalized = period.status === "FINALIZED";
  const tag = `${period.year}${String(period.month).padStart(2, "0")}`;

  async function download(id: PayrollReportId) {
    setBusy(id);
    setError(null);
    try {
      const blob = await downloadPayrollReport(period.id, id);
      const ext = id === "pf-ecr" ? "txt" : "csv";
      downloadBlob(`${id}_${tag}.${ext}`, blob);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="period-reports-heading"
      className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <h3
        id="period-reports-heading"
        className="text-theme-md font-semibold text-gray-900 dark:text-white/90"
      >
        Statutory files & reports
      </h3>
      <div className="flex flex-wrap gap-2">
        {PAYROLL_REPORTS.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant="secondary"
            disabled={(r.finalizedOnly && !finalized) || busy !== null}
            loading={busy === r.id}
            title={
              r.finalizedOnly && !finalized
                ? "Available once the period is finalized"
                : undefined
            }
            onClick={() => void download(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>
      <ServerError message={error} />
    </section>
  );
}
