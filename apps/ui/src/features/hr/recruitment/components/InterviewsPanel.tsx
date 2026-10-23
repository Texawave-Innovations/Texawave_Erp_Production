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
  Plus,
  Search,
  User,
  Video,
  Phone,
  Briefcase,
  Eye,
  ArrowLeft,
  CheckCircle2,
  UserCheck,
  Building2,
  ExternalLink,
  ChevronDown,
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

/** Avatar colors conforming strictly to TexaOne brand palette */
const AVATAR_COLORS = [
  "bg-brand-600 text-white",
  "bg-sky-600 text-white",
  "bg-cyan-600 text-white",
  "bg-[#0a3271] text-white",
  "bg-teal-600 text-white",
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
  return AVATAR_COLORS[index] ?? "bg-brand-600 text-white";
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

  // Global KPI Summary & Roles query: unfiltered by status/search so card counts remain stable
  const summaryQuery = useInterviews({
    page: 1,
    limit: 100,
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
    toast({ title: "Interview scheduled successfully", variant: "success" });
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
    const raw = summaryQuery.data?.data ?? query.data?.data ?? [];
    const set = new Set<string>();
    raw.forEach((r) => set.add(r.roleTitle));
    return Array.from(set);
  }, [summaryQuery.data?.data, query.data?.data]);

  // High-level KPI Summary metrics calculated from global summaryQuery
  const stats = useMemo(() => {
    const all = summaryQuery.data?.data ?? query.data?.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = all.filter((i) => i.interviewDate === today).length;
    const scheduledCount = all.filter((i) => i.status === "SCHEDULED").length;
    const completedCount = all.filter((i) => i.status === "COMPLETED").length;
    const selectedCount = all.filter((i) => i.status === "SELECTED").length;
    return {
      todayCount,
      scheduledCount,
      completedCount,
      selectedCount,
      total: summaryQuery.data?.meta?.total ?? all.length,
    };
  }, [summaryQuery.data, query.data]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isTodayActive = dateRange.from === todayStr && dateRange.to === todayStr;
  const isScheduledActive = statusFilter === "SCHEDULED" && !isTodayActive;
  const isCompletedActive = statusFilter === "COMPLETED" && !isTodayActive;
  const isSelectedActive = statusFilter === "SELECTED" && !isTodayActive;

  function handleKpiCardClick(
    type: "today" | "SCHEDULED" | "COMPLETED" | "SELECTED",
  ) {
    if (type === "today") {
      if (isTodayActive) {
        // Toggle off
        setDateRange({ from: "", to: "" });
      } else {
        // Toggle on today, reset status filter
        setDateRange({ from: todayStr, to: todayStr });
        setStatusFilter("all");
      }
    } else {
      // Status filter
      if (statusFilter === type && !isTodayActive) {
        // Toggle off
        setStatusFilter("all");
      } else {
        // Toggle on this status, reset date range so they don't conflict
        setStatusFilter(type);
        setDateRange({ from: "", to: "" });
      }
    }
    setPage(1);
  }

  // If in create view, render Screen 2: Schedule Interview (Centered Max-Width Container)
  if (viewMode === "create") {
    return (
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 py-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="inline-flex items-center gap-1.5 text-theme-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-cyan-400"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to interview schedule
              </button>
            </div>
            <h2 className="text-theme-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Schedule New Interview
            </h2>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Set up candidate evaluation, timings, interviewer panel and meeting location.
            </p>
          </div>
        </div>

        <Card className="p-6 md:p-8 shadow-theme-xs border border-gray-200 dark:border-gray-800">
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
          <h2 className="text-theme-lg font-bold text-gray-900 dark:text-white">
            Interview Schedule
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Schedule, manage, and evaluate candidate interview pipelines.
          </p>
        </div>
        {canWrite ? (
          <Button
            onClick={() => setViewMode("create")}
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl px-4 py-2 font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Schedule interview
          </Button>
        ) : null}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Card 1: Today's Schedule */}
        <Card
          data-testid="kpi-card-today"
          onClick={() => handleKpiCardClick("today")}
          className={`p-4 cursor-pointer transition-all shadow-xs group ${
            isTodayActive
              ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30 dark:bg-brand-950/20"
              : "hover:border-brand-300 dark:hover:border-brand-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Today's Schedule
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {stats.todayCount}
            </span>
            <span className="text-[11px] font-medium text-brand-600 dark:text-cyan-400">
              Slots today
            </span>
          </div>
        </Card>

        {/* Card 2: Total Scheduled */}
        <Card
          data-testid="kpi-card-scheduled"
          onClick={() => handleKpiCardClick("SCHEDULED")}
          className={`p-4 cursor-pointer transition-all shadow-xs group ${
            isScheduledActive
              ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30 dark:bg-brand-950/20"
              : "hover:border-brand-300 dark:hover:border-brand-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Active Scheduled
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300 group-hover:scale-105 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {stats.scheduledCount}
            </span>
            <span className="text-[11px] font-medium text-gray-500">
              Pending review
            </span>
          </div>
        </Card>

        {/* Card 3: Completed */}
        <Card
          data-testid="kpi-card-completed"
          onClick={() => handleKpiCardClick("COMPLETED")}
          className={`p-4 cursor-pointer transition-all shadow-xs group ${
            isCompletedActive
              ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30 dark:bg-brand-950/20"
              : "hover:border-brand-300 dark:hover:border-brand-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Completed
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {stats.completedCount}
            </span>
            <span className="text-[11px] font-medium text-gray-500">
              Conducted
            </span>
          </div>
        </Card>

        {/* Card 4: Selected / Cleared */}
        <Card
          data-testid="kpi-card-selected"
          onClick={() => handleKpiCardClick("SELECTED")}
          className={`p-4 cursor-pointer transition-all shadow-xs group ${
            isSelectedActive
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20"
              : "hover:border-brand-300 dark:hover:border-brand-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Candidates Selected
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 group-hover:scale-105 transition-transform">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {stats.selectedCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-600">
              Offer ready
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar (Responsive flex container preventing overflow) */}
      <Card className="p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-50 sm:min-w-65">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="search"
              aria-label="Search interviews"
              placeholder="Search candidate, role or interviewer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 rounded-xl"
            />
          </div>

          <div className="w-full sm:w-44 shrink-0">
            <Select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl w-full"
            >
              <option value="all">All roles</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-40 shrink-0">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InterviewStatus | "all");
                setPage(1);
              }}
              className="rounded-xl w-full"
            >
              <option value="all">All statuses</option>
              {INTERVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {INTERVIEW_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-auto shrink-0">
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
          </div>

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
              className="shrink-0 rounded-xl h-10 px-4 font-semibold text-theme-xs"
            >
              Reset Filters
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Main Body */}
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
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

                  // Extract email & phone if packed into notes
                  const emailMatch = /Email:\s*([^\s|]+)/.exec(item.notes ?? "");
                  const phoneMatch = /Phone:\s*([^\s|]+)/.exec(item.notes ?? "");
                  const email = emailMatch ? emailMatch[1] : null;
                  const phone = phoneMatch ? phoneMatch[1] : null;

                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-xs shadow-xs ${colorClass}`}
                      >
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {item.candidateName}
                        </span>
                        {email || phone ? (
                          <div className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {email && <span>{email}</span>}
                            {email && phone && <span>•</span>}
                            {phone && <span>{phone}</span>}
                          </div>
                        ) : item.notes ? (
                          <span className="max-w-xs truncate text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
                cell: (item) => {
                  // Extract department if packed
                  const deptMatch = /Dept:\s*([^|\n]+)/.exec(item.notes ?? "");
                  const dept = deptMatch ? deptMatch[1]?.trim() : null;
                  return (
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.roleTitle}
                      </span>
                      {dept ? (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {dept}
                        </span>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                header: "Interviewer",
                cell: (item) => (
                  <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium">{item.interviewerName}</span>
                  </div>
                ),
              },
              {
                header: "Date & Time",
                cell: (item) => (
                  <div className="flex flex-col whitespace-nowrap text-theme-xs">
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {formatDate(item.interviewDate)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-theme-xs font-semibold ${
                        isOnline
                          ? "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-cyan-300 dark:border-sky-800"
                          : "bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800"
                      }`}
                    >
                      {isOnline ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5" />
                      )}
                      {modeLabel}
                    </span>
                  );
                },
              },
              {
                header: "Status",
                cell: (item) => {
                  if (!canWrite) {
                    return (
                      <StatusBadge
                        label={INTERVIEW_STATUS_LABELS[item.status]}
                        colorToken={STATUS_TOKEN[item.status]}
                      />
                    );
                  }

                  return (
                    <div className="w-36">
                      <Select
                        aria-label={`Status for ${item.candidateName}`}
                        value={item.status}
                        disabled={statusMutation.isPending}
                        onChange={(e) =>
                          void handleStatusChange(
                            item,
                            e.target.value as InterviewStatus,
                          )
                        }
                        className="w-full"
                        triggerClassName={`h-8 px-2.5 py-1 text-theme-xs font-semibold rounded-lg shadow-2xs border transition-all ${
                          item.status === "SCHEDULED"
                            ? "border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-400 dark:border-sky-800 dark:bg-sky-950/40 dark:text-cyan-300"
                            : item.status === "COMPLETED"
                              ? "border-gray-300 bg-gray-100 text-gray-800 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                              : item.status === "SELECTED"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : item.status === "REJECTED"
                                  ? "border-rose-300 bg-rose-50 text-rose-800 hover:border-rose-400 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                  : "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {INTERVIEW_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {INTERVIEW_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                },
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (item) => {
                  // Extract meeting link if online
                  const linkMatch = /Link:\s*(https?:\/\/[^\s|]+)/.exec(
                    item.notes ?? "",
                  );
                  const meetingLink = linkMatch ? linkMatch[1] : null;

                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      {meetingLink ? (
                        <a
                          href={meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Join Online Meeting"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-theme-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-cyan-300"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Join</span>
                        </a>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(item.id)}
                        aria-label={`View interview for ${item.candidateName}`}
                        className="inline-flex items-center gap-1 text-theme-xs font-semibold text-gray-700 hover:text-brand-600 dark:text-gray-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Button>
                    </div>
                  );
                },
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
        title="Interview Details & Assessment"
      >
        {detail.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load interview">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <div className="space-y-4">
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

            {/* Quick Actions inside Dialog */}
            {canWrite && detail.data.status !== "SELECTED" && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleStatusChange(detail.data, "COMPLETED");
                    setDetailId(null);
                  }}
                  className="rounded-xl text-theme-xs font-semibold"
                >
                  Mark Completed
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    void handleStatusChange(detail.data, "SELECTED");
                    setDetailId(null);
                  }}
                  className="rounded-xl text-theme-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Select Candidate
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
