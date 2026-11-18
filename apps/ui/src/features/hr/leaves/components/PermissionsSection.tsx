"use client";

import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useAllWorkPermissions,
  useDecideWorkPermission,
} from "@/features/employee-self-service/work-permissions/hooks";
import type { WorkPermission } from "@/features/employee-self-service/work-permissions/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMins(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:border-success-800/40 dark:bg-success-900/20 dark:text-success-400">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2 py-0.5 text-[11px] font-semibold text-error-700 dark:border-error-800/40 dark:bg-error-900/20 dark:text-error-400">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:border-warning-800/40 dark:bg-warning-900/20 dark:text-warning-400">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

// ── Decide dialog ─────────────────────────────────────────────────────────────

function DecideDialog({
  request,
  decision,
  onClose,
}: {
  request: WorkPermission;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
}) {
  const [hrNote, setHrNote] = useState("");
  const { toast } = useToast();
  const mutation = useDecideWorkPermission();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        id: request.id,
        decision,
        ...(hrNote.trim() ? { hrNote: hrNote.trim() } : {}),
      });
      toast({
        title: `Permission ${decision === "APPROVED" ? "approved" : "rejected"}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      toast({
        title:
          err instanceof ApiError
            ? err.message
            : "Action failed. Please try again.",
        variant: "error",
      });
    }
  }

  const isApprove = decision === "APPROVED";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          {isApprove ? "Approve" : "Reject"} Permission Request
        </h3>
        <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
          {request.employee.fullName} · {formatDate(request.date)} ·{" "}
          {request.fromTime}–{request.toTime} (
          {formatMins(request.durationMins)})
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Note {isApprove ? "(optional)" : "(required)"}
            </label>
            <textarea
              value={hrNote}
              onChange={(e) => setHrNote(e.target.value)}
              rows={3}
              maxLength={500}
              required={!isApprove}
              placeholder={
                isApprove
                  ? "Optional message to employee…"
                  : "Reason for rejection…"
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isApprove ? "primary" : "destructive"}
              loading={mutation.isPending}
            >
              {isApprove ? "Approve" : "Reject"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export function PermissionsSection() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [deciding, setDeciding] = useState<{
    request: WorkPermission;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);

  const { data, isPending, isError, refetch } = useAllWorkPermissions({
    ...(status ? { status } : {}),
    page,
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Work Permission Requests
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Review and approve employee short-time permission requests.
          </p>
        </div>

        {/* status filter */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-theme-xs font-medium transition-colors ${
                status === f.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <TableSkeleton rowsCount={5} columnsCount={6} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No permission requests"
            description={
              status
                ? `No ${status.toLowerCase()} permission requests found.`
                : "No work permission requests have been submitted yet."
            }
          />
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  {[
                    "Employee",
                    "Date",
                    "Time",
                    "Duration",
                    "Reason",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 first:pl-5 last:pr-5 text-theme-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 pl-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                          {item.employee.fullName}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {item.employee.employeeCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-theme-sm font-medium text-gray-900 dark:text-white/90 whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {item.fromTime} – {item.toTime}
                    </td>
                    <td className="px-4 py-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                      {formatMins(item.durationMins)}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span
                        className="block truncate text-theme-sm text-gray-600 dark:text-gray-300"
                        title={item.reason}
                      >
                        {item.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={item.status} />
                        {item.hrNote ? (
                          <span
                            className="max-w-[160px] truncate text-[11px] text-gray-500 dark:text-gray-400"
                            title={item.hrNote}
                          >
                            Note: {item.hrNote}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 pr-5">
                      {item.status === "PENDING" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDeciding({
                                request: item,
                                decision: "APPROVED",
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setDeciding({
                                request: item,
                                decision: "REJECTED",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                          {item.decider ? `by ${item.decider.fullName}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {deciding && (
        <DecideDialog
          request={deciding.request}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  );
}
