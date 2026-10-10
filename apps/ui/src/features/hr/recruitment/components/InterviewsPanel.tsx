"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateRangePicker,
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
import {
  Calendar,
  Clock,
  Filter,
  Plus,
  Search,
  User,
  Video,
  Phone,
  Briefcase,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDepartments } from "@/features/departments/hooks";
import { useDesignations } from "@/features/designations/hooks";
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
  type InterviewMode,
  type InterviewStatus,
  type InterviewView,
} from "../types";
import { apiErrorMessage, formatDate, useDebouncedValue } from "../utils";
import { DetailList } from "./DetailList";
import { InterviewForm } from "./InterviewForm";

const PAGE_SIZE = 10;

/** Status color tokens */
const STATUS_TOKEN: Record<InterviewStatus, StatusColorToken> = {
  SCHEDULED: "brand",
  COMPLETED: "gray",
  SELECTED: "success",
  REJECTED: "error",
  NO_SHOW: "warning",
};

/** Deterministic background color for avatar circles based on string initials */
const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-cyan-600 text-white",
  "bg-indigo-600 text-white",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CA";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase() || "CA";
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "CA";
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? "bg-blue-600 text-white";
}

export interface InterviewsPanelProps {
  canWrite: boolean;
}

export function InterviewsPanel({ canWrite }: InterviewsPanelProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "all">(
    "all",
  );
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [detailId, setDetailId] = useState<number | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useInterviews({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  });

  const { data: deptData } = useDepartments();
  const { data: desigData } = useDesignations();
  const departments = useMemo(() => deptData?.data ?? [], [deptData]);
  const designations = useMemo(() => desigData?.data ?? [], [desigData]);

  const createMutation = useCreateInterview();
  const statusMutation = useSetInterviewStatus();
  const detail = useInterview(detailId ?? undefined);

  async function handleCreate(input: CreateInterviewInput) {
    await createMutation.mutateAsync(input);
    setViewMode("list");
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

  // Filter rows locally if roleFilter or dateRange are set
  const rows = useMemo(() => {
    let list = query.data?.data ?? [];
    if (roleFilter !== "all") {
      list = list.filter((item) =>
        item.roleTitle.toLowerCase().includes(roleFilter.toLowerCase()),
      );
    }
    if (dateRange.from && dateRange.to) {
      list = list.filter(
        (item) =>
          item.interviewDate >= dateRange.from &&
          item.interviewDate <= dateRange.to,
      );
    } else if (dateRange.from) {
      list = list.filter((item) => item.interviewDate >= dateRange.from);
    } else if (dateRange.to) {
      list = list.filter((item) => item.interviewDate <= dateRange.to);
    }
    return list;
  }, [query.data?.data, roleFilter, dateRange]);

  const availableRoles = useMemo(() => {
    const raw = query.data?.data ?? [];
    const set = new Set<string>();
    raw.forEach((r) => set.add(r.roleTitle));
    return Array.from(set);
  }, [query.data?.data]);

  // If in create view, render Screen 2: Schedule Interview
  if (viewMode === "create") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to interviews
              </button>
            </div>
            <h2 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white/90">
              Schedule Interview
            </h2>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Enter the candidate and interview details.
            </p>
          </div>
        </div>

        <Card className="p-6 md:p-8">
          <InterviewForm
            onSubmit={handleCreate}
            onCancel={() => setViewMode("list")}
            departments={departments}
            designations={designations}
          />
        </Card>
      </div>
    );
  }

  // List View (Screen 1)
  return (
    <div className="flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Interview Schedule
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Schedule and manage candidate interviews.
          </p>
        </div>
        {canWrite ? (
          <Button
            onClick={() => setViewMode("create")}
            className="inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Schedule interview
          </Button>
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="search"
              aria-label="Search interviews"
              placeholder="Search by candidate name, role or interviewer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>

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

          <div className="flex items-center gap-2">
            <DateRangePicker
              value={dateRange}
              align="right"
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
              onClear={() => {
                setDateRange({ from: "", to: "" });
                setPage(1);
              }}
              fromAriaLabel="Filter from date"
              toAriaLabel="Filter to date"
            />
            {dateRange.from ||
            dateRange.to ||
            roleFilter !== "all" ||
            statusFilter !== "all" ||
            search ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                  setDateRange({ from: "", to: "" });
                  setPage(1);
                }}
                className="shrink-0"
              >
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Main Body */}
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="Access denied">
            You do not have permission to view the interview schedule.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No interviews found"
            description={
              debouncedSearch || statusFilter !== "all" || roleFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Scheduled interviews will appear here."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable<InterviewView>
            caption="Interview schedule"
            rows={rows}
            getRowKey={(item) => String(item.id)}
            columns={[
              {
                header: "Candidate",
                cell: (item) => {
                  const initials = getInitials(item.candidateName);
                  const colorClass = getAvatarColor(item.candidateName);
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs shadow-sm ${colorClass}`}
                      >
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-white/90 truncate">
                          {item.candidateName}
                        </span>
                        {item.notes ? (
                          <span className="max-w-xs truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {item.notes}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                },
              },
              {
                header: "Role / Position",
                cell: (item) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {item.roleTitle}
                  </span>
                ),
              },
              {
                header: "Interviewer",
                cell: (item) => (
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.interviewerName}
                  </span>
                ),
              },
              {
                header: "Date & Time",
                cell: (item) => (
                  <div className="flex flex-col whitespace-nowrap text-theme-xs">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(item.interviewDate)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {item.interviewTime}
                    </span>
                  </div>
                ),
              },
              {
                header: "Mode",
                cell: (item) => {
                  const modeLabel =
                    INTERVIEW_MODE_LABELS[item.mode] ?? item.mode;
                  const isOnline = item.mode === "ONLINE";
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-theme-xs font-medium ${
                        isOnline
                          ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          : "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                      }`}
                    >
                      {isOnline ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      {modeLabel}
                    </span>
                  );
                },
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
                        className="h-8 w-36 text-theme-xs"
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
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailId(item.id)}
                      aria-label={`View interview for ${item.candidateName}`}
                      className="inline-flex items-center gap-1 text-theme-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </div>
                ),
              },
            ]}
          />

          {query.data?.meta ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2 text-theme-sm text-gray-500">
              <span>
                Showing{" "}
                {Math.min((page - 1) * PAGE_SIZE + 1, query.data.meta.total)} to{" "}
                {Math.min(page * PAGE_SIZE, query.data.meta.total)} of{" "}
                {query.data.meta.total} interviews
              </span>
              <Pagination
                page={query.data.meta.page}
                totalPages={query.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Detail Dialog */}
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
