"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import type { StatusColorToken } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateInterview,
  useInterview,
  useInterviews,
  useSetInterviewStatus,
} from "../hooks";
import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_STATUSES,
  INTERVIEW_STATUS_LABELS,
  type CreateInterviewInput,
  type InterviewStatus,
  type InterviewView,
} from "../types";
import { apiErrorMessage, formatDate, useDebouncedValue } from "../utils";
import { DetailList } from "./DetailList";
import { InterviewForm } from "./InterviewForm";

const PAGE_SIZE = 10;

/** Badge colour per status. Labels always render as text (never colour alone). */
const STATUS_TOKEN: Record<InterviewStatus, StatusColorToken> = {
  SCHEDULED: "brand",
  COMPLETED: "gray",
  SELECTED: "success",
  REJECTED: "error",
  NO_SHOW: "warning",
};

export interface InterviewsPanelProps {
  canWrite: boolean;
}

export function InterviewsPanel({ canWrite }: InterviewsPanelProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "all">(
    "all",
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useInterviews({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  });
  const createMutation = useCreateInterview();
  const statusMutation = useSetInterviewStatus();
  const detail = useInterview(detailId ?? undefined);

  async function handleCreate(input: CreateInterviewInput) {
    await createMutation.mutateAsync(input);
    setScheduleOpen(false);
    setPage(1);
    toast({ title: "Interview scheduled", variant: "success" });
  }

  async function handleStatusChange(
    item: InterviewView,
    status: InterviewStatus,
  ) {
    if (status === item.status) return;
    try {
      await statusMutation.mutateAsync({ id: item.id, status });
      toast({
        title: `Status set to ${INTERVIEW_STATUS_LABELS[status]}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: apiErrorMessage(error, "Could not update the status"),
        variant: "error",
      });
    }
  }

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          Interview schedule
        </h2>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Schedule and track candidate interviews, and record their outcome.
        </p>
      </div>
      {canWrite ? (
        <Button onClick={() => setScheduleOpen(true)}>
          Schedule interview
        </Button>
      ) : null}
    </div>
  );

  const filters = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
      <Input
        type="search"
        aria-label="Search interviews"
        placeholder="Search candidate, role or interviewer"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Select
        aria-label="Filter by status"
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value as InterviewStatus | "all");
          setPage(1);
        }}
      >
        <option value="all">All statuses</option>
        {INTERVIEW_STATUSES.map((status) => (
          <option key={status} value={status}>
            {INTERVIEW_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
    </div>
  );

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body =
      query.error instanceof ApiError && query.error.isPermissionError ? (
        <Alert variant="warning" title="Access denied">
          You do not have permission to view the interview schedule.
        </Alert>
      ) : (
        <ErrorState onRetry={() => void query.refetch()} />
      );
  } else {
    const rows = query.data.data;
    const meta = query.data.meta;
    body =
      rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No interviews found"
            description={
              debouncedSearch || statusFilter !== "all"
                ? "Try a different search or status filter."
                : "Scheduled interviews will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<InterviewView>
            caption="Interview schedule"
            rows={rows}
            getRowKey={(item) => String(item.id)}
            columns={[
              {
                header: "Candidate",
                cell: (item) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {item.candidateName}
                    </span>
                    {item.notes ? (
                      <span className="max-w-xs truncate text-theme-xs text-gray-500">
                        {item.notes}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              { header: "Role", cell: (item) => item.roleTitle },
              { header: "Interviewer", cell: (item) => item.interviewerName },
              {
                header: "Schedule",
                cell: (item) => (
                  <span className="whitespace-nowrap">
                    {formatDate(item.interviewDate)} at {item.interviewTime}
                  </span>
                ),
              },
              {
                header: "Mode",
                cell: (item) => INTERVIEW_MODE_LABELS[item.mode],
              },
              {
                header: "Status",
                cell: (item) => (
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge
                      label={INTERVIEW_STATUS_LABELS[item.status]}
                      colorToken={STATUS_TOKEN[item.status]}
                    />
                    {canWrite ? (
                      <Select
                        aria-label={`Change status for ${item.candidateName}`}
                        className="h-9 w-40 text-theme-xs"
                        value={item.status}
                        disabled={statusMutation.isPending}
                        onChange={(e) =>
                          void handleStatusChange(
                            item,
                            e.target.value as InterviewStatus,
                          )
                        }
                      >
                        {INTERVIEW_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {INTERVIEW_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (item) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailId(item.id)}
                    aria-label={`View interview for ${item.candidateName}`}
                  >
                    View
                  </Button>
                ),
              },
            ]}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {filters}
      {body}

      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule interview"
      >
        <InterviewForm
          onSubmit={handleCreate}
          onCancel={() => setScheduleOpen(false)}
        />
      </Dialog>

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Interview details"
      >
        {detail.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load interview">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <DetailList
            items={[
              { label: "Candidate", value: detail.data.candidateName },
              { label: "Role", value: detail.data.roleTitle },
              { label: "Interviewer", value: detail.data.interviewerName },
              {
                label: "Schedule",
                value: `${formatDate(detail.data.interviewDate)} at ${detail.data.interviewTime}`,
              },
              { label: "Mode", value: INTERVIEW_MODE_LABELS[detail.data.mode] },
              {
                label: "Status",
                value: INTERVIEW_STATUS_LABELS[detail.data.status],
              },
              { label: "Notes", value: detail.data.notes ?? "—" },
            ]}
          />
        )}
      </Dialog>
    </div>
  );
}
