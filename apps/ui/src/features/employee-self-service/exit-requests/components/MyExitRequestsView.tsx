"use client";

import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import {
  CircleCheck,
  CircleX,
  Clock,
  DoorOpen,
  Eye,
  Info,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useCreateMyExitRequest, useMyExitRequests } from "../hooks";
import type { MyExitRequest } from "../api";

// Legacy ExitRequest.tsx statusConfig.
const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string; icon: LucideIcon }
> = {
  SUBMITTED: {
    label: "Submitted",
    cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    icon: TriangleAlert,
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
    icon: CircleCheck,
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    icon: CircleX,
  },
  COMPLETED: {
    label: "Completed",
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    icon: CircleCheck,
  },
};

const SETTLEMENT_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

const ACTIVE = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED"]);

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SUBMITTED!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.cls}`}
    >
      <cfg.icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function RaiseExitRequestForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExitRequest();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [noticeDays, setNoticeDays] = useState("30");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    if (!lastWorkingDate) {
      setError("Please select preferred last working date");
      return;
    }
    try {
      await createMutation.mutateAsync({
        reason: reason.trim(),
        preferredLastWorkingDate: lastWorkingDate,
        noticePeriodDays: Number(noticeDays) || 30,
        ...(additionalNotes.trim()
          ? { additionalNotes: additionalNotes.trim() }
          : {}),
      });
      toast({
        title: "Exit request submitted. HR will review and respond shortly.",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to submit. Please try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Submit your resignation request details for HR review.
      </p>
      <FormField label="Reason for Leaving" required>
        {(f) => (
          <Textarea
            {...f}
            rows={3}
            placeholder="Please provide your reason for leaving..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Preferred Last Working Date" required>
          {(f) => (
            <Input
              {...f}
              type="date"
              min={todayIso()}
              value={lastWorkingDate}
              onChange={(e) => setLastWorkingDate(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Notice Period (days)">
          {(f) => (
            <Input
              {...f}
              type="number"
              min="0"
              placeholder="30"
              value={noticeDays}
              onChange={(e) => setNoticeDays(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField label="Additional Notes">
        {(f) => (
          <Textarea
            {...f}
            rows={2}
            placeholder="Any handover notes, pending work details..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
          />
        )}
      </FormField>
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
        <strong>Note:</strong> Submitting this request will initiate the exit
        process. HR will review and confirm your last working date.
      </div>
      {error ? (
        <Alert variant="error" title="Could not submit">
          {error}
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          loading={createMutation.isPending}
          disabled={!reason.trim() || !lastWorkingDate}
        >
          Submit Exit Request
        </Button>
      </div>
    </form>
  );
}

function InfoTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={`space-y-1 rounded-md border p-3 ${
        tone === "success"
          ? "border-green-200 bg-green-50/50 dark:border-green-900/60 dark:bg-green-950/30"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
      }`}
    >
      <span
        className={`block text-[11px] font-semibold uppercase tracking-wider ${
          tone === "success"
            ? "text-green-700 dark:text-green-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm ${
          tone === "success"
            ? "font-bold text-green-800 dark:text-green-300"
            : "font-medium text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ExitRequestDetails({ req }: { req: MyExitRequest }) {
  return (
    <div className="space-y-4 text-xs">
      <p className="text-gray-500 dark:text-gray-400">
        View details of your submitted exit request.
      </p>
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-500">Status:</span>
          <StatusPill status={req.status} />
        </div>
        <span className="font-medium text-gray-500">
          Submitted: {fmtDate(req.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoTile label="Request Date" value={fmtDate(req.createdAt)} />
        <InfoTile
          label="Preferred Last Working Date"
          value={req.preferredLastWorkingDate || "-"}
        />
        <InfoTile
          label="Notice Period"
          value={`${req.noticePeriodDays} days`}
        />
        {req.confirmedLastWorkingDate ? (
          <InfoTile
            label="Confirmed Last Working Date"
            value={req.confirmedLastWorkingDate}
            tone="success"
          />
        ) : null}
        {req.settlementStatus ? (
          <InfoTile
            label="Settlement Status"
            value={
              SETTLEMENT_LABELS[req.settlementStatus] ?? req.settlementStatus
            }
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <span className="mb-1 block font-semibold text-gray-500">
            Reason for Leaving
          </span>
          <p className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 leading-relaxed text-gray-900 dark:border-gray-800 dark:bg-gray-800/40 dark:text-white">
            {req.reason}
          </p>
        </div>
        {req.additionalNotes ? (
          <div>
            <span className="mb-1 block font-semibold text-gray-500">
              Additional Notes
            </span>
            <p className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 leading-relaxed text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
              {req.additionalNotes}
            </p>
          </div>
        ) : null}
        {req.hrNote ? (
          <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50/70 p-3 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
            <p className="flex items-center gap-1 font-semibold">
              <Info className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              HR Note:
            </p>
            <p className="leading-relaxed">{req.hrNote}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The employee's exit requests, laid out like the legacy page
 * (TexaWave_ERP_old src/modules/employee/ExitRequest.tsx): header with
 * "Raise Exit Request", an "active request exists" banner, the Exit Request
 * History table with View Details, a raise dialog (reason, preferred last
 * day, notice period, notes) and a details dialog.
 */
export function MyExitRequestsView() {
  const query = useMyExitRequests();
  const { toast } = useToast();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [viewing, setViewing] = useState<MyExitRequest | null>(null);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to exit requests"
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const requests = [...query.data].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const hasActiveRequest = requests.some((r) => ACTIVE.has(r.status));

  function openRaise() {
    if (hasActiveRequest) {
      toast({
        title: "You already have an active exit request",
        variant: "error",
      });
      return;
    }
    setRaiseOpen(true);
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Exit Request
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Submit your resignation and track the exit process
          </p>
        </div>
        <Button onClick={openRaise} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Raise Exit Request
        </Button>
      </div>

      {hasActiveRequest ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <TriangleAlert
            className="h-5 w-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Active exit request exists</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              You cannot raise a new request until the current one is resolved.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="w-full p-0">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <DoorOpen className="h-5 w-5 text-brand-500" aria-hidden="true" />
            Exit Request History
          </h2>
          {requests.length > 0 ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {requests.length} {requests.length === 1 ? "Request" : "Requests"}
            </span>
          ) : null}
        </div>
        {requests.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <DoorOpen className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              No exit requests yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
              Submit an exit request to start the resignation process.
            </p>
            <Button size="sm" className="mt-4" onClick={openRaise}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Raise Exit Request
            </Button>
          </div>
        ) : (
          <DataTable<MyExitRequest>
            caption="Exit request history"
            rows={requests}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Request Date",
                cell: (r) => (
                  <span className="text-xs font-medium">
                    {fmtDate(r.createdAt)}
                  </span>
                ),
              },
              {
                header: "Preferred Last Working Date",
                cell: (r) => (
                  <span className="text-xs font-medium">
                    {r.preferredLastWorkingDate || "-"}
                  </span>
                ),
              },
              {
                header: "Notice Period",
                cell: (r) => (
                  <span className="text-xs">{r.noticePeriodDays} days</span>
                ),
              },
              {
                header: "Status",
                cell: (r) => <StatusPill status={r.status} />,
              },
              {
                header: "Action",
                headerClassName: "text-right",
                className: "text-right whitespace-nowrap",
                cell: (r) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewing(r)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    View Details
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Dialog
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        title="Raise Exit Request"
        size="lg"
      >
        {raiseOpen ? (
          <RaiseExitRequestForm onClose={() => setRaiseOpen(false)} />
        ) : null}
      </Dialog>

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Exit Request Details"
        size="lg"
      >
        {viewing ? (
          <>
            <ExitRequestDetails req={viewing} />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
