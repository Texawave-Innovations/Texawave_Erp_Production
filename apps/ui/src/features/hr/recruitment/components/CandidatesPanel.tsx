"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import type { StatusColorToken } from "@texawave-erp/ui-kit";
import { Calendar, FileText, Search, UserCheck } from "lucide-react";
import { useInterviews, useOffers } from "../hooks";
import { INTERVIEW_STATUS_LABELS, type InterviewStatus } from "../types";
import { formatDate, useDebouncedValue } from "../utils";

const PAGE_SIZE = 10;

const STATUS_TOKEN: Record<string, StatusColorToken> = {
  SCHEDULED: "brand",
  COMPLETED: "gray",
  SELECTED: "success",
  REJECTED: "error",
  NO_SHOW: "warning",
  OFFERED: "brand",
};

export interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  source?: string;
  stage: string;
  interviewer?: string;
  interviewDate?: string;
  interviewTime?: string;
  hasOffer?: boolean;
}

export interface CandidatesPanelProps {
  onScheduleCandidate?: (candidate: { name: string; role: string }) => void;
  onGenerateOffer?: (candidate: { name: string; role: string }) => void;
}

/**
 * Candidates Talent Pipeline Panel.
 * Aggregates candidate records across interview rounds and offer letters.
 */
export function CandidatesPanel({
  onScheduleCandidate,
  onGenerateOffer,
}: CandidatesPanelProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase());

  // Fetch interviews & offers to build candidate pipeline
  const interviewsQuery = useInterviews({ page: 1, limit: 100 });
  const offersQuery = useOffers({ page: 1, limit: 100 });

  const candidates = useMemo(() => {
    const map = new Map<string, CandidateRecord>();

    // 1. Ingest interview candidates
    const interviews = interviewsQuery.data?.data ?? [];
    for (const item of interviews) {
      const key = item.candidateName.toLowerCase().trim();
      let email = "";
      let phone = "";
      let dept = "Engineering";

      // Parse metadata from notes if stored as Email: ... | Phone: ...
      if (item.notes) {
        const emailMatch = item.notes.match(/Email:\s*([^\s|]+)/i);
        if (emailMatch?.[1]) email = emailMatch[1];
        const phoneMatch = item.notes.match(/Phone:\s*([^\s|]+)/i);
        if (phoneMatch?.[1]) phone = phoneMatch[1];
        const deptMatch = item.notes.match(/Dept:\s*([^\s|]+)/i);
        if (deptMatch?.[1]) dept = deptMatch[1];
      }

      if (!email) {
        email = `${key.replace(/\s+/g, ".")}@example.com`;
      }

      map.set(key, {
        id: `candidate-${item.id}`,
        name: item.candidateName,
        email,
        phone: phone || "+91 98400 12345",
        role: item.roleTitle,
        department: dept,
        source: "Direct / Portal",
        stage: item.status,
        interviewer: item.interviewerName,
        interviewDate: item.interviewDate,
        interviewTime: item.interviewTime,
      });
    }

    // 2. Mark offer candidates
    const offers = offersQuery.data?.data ?? [];
    for (const off of offers) {
      const key = off.candidateName.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.stage = "OFFERED";
        existing.hasOffer = true;
      } else {
        map.set(key, {
          id: `offer-candidate-${off.id}`,
          name: off.candidateName,
          email: `${key.replace(/\s+/g, ".")}@example.com`,
          phone: "+91 98400 54321",
          role: off.role,
          department: "Engineering",
          stage: "OFFERED",
          hasOffer: true,
        });
      }
    }

    return Array.from(map.values());
  }, [interviewsQuery.data?.data, offersQuery.data?.data]);

  // Filter candidates
  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        !debouncedSearch ||
        c.name.toLowerCase().includes(debouncedSearch) ||
        c.role.toLowerCase().includes(debouncedSearch) ||
        c.email.toLowerCase().includes(debouncedSearch);
      const matchesStatus = statusFilter === "all" || c.stage === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [candidates, debouncedSearch, statusFilter]);

  // Pagination slice
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Loading state
  if (interviewsQuery.isPending && offersQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Summary */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
            Candidate Pipeline
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Candidates registered across scheduled interviews and generated
            offer letters.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-xs">
          <label htmlFor="candidates-search" className="sr-only">
            Search candidates
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <Input
            id="candidates-search"
            placeholder="Search candidate name or role..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 text-theme-xs h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            aria-label="Filter by candidate stage"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 min-w-36 text-theme-xs"
          >
            <option value="all">All stages</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Interviewed</option>
            <option value="SELECTED">Selected</option>
            <option value="OFFERED">Offered</option>
            <option value="REJECTED">Rejected</option>
            <option value="NO_SHOW">No Show</option>
          </Select>

          {statusFilter !== "all" || search ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="h-9 px-3 text-theme-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No candidates found"
            description={
              search || statusFilter !== "all"
                ? "No candidates match the specified filters."
                : "Schedule an interview to add candidates to the recruitment pipeline."
            }
          />
        </Card>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs overflow-hidden dark:border-gray-800 dark:bg-gray-900">
          <DataTable<CandidateRecord>
            caption="Recruitment candidate pipeline"
            rows={paginatedRows}
            getRowKey={(item) => item.id}
            columns={[
              {
                header: "Candidate",
                cell: (item) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white/90 text-theme-xs">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {item.email}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                header: "Role / Position",
                cell: (item) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {item.role}
                  </span>
                ),
              },
              {
                header: "Department",
                cell: (item) => (
                  <span className="text-gray-600 dark:text-gray-400 text-theme-xs">
                    {item.department || "Engineering"}
                  </span>
                ),
              },
              {
                header: "Stage / Status",
                cell: (item) => {
                  const label =
                    item.stage === "OFFERED"
                      ? "Offered"
                      : INTERVIEW_STATUS_LABELS[
                          item.stage as InterviewStatus
                        ] || item.stage;
                  const token = STATUS_TOKEN[item.stage] || "gray";
                  return <StatusBadge label={label} colorToken={token} />;
                },
              },
              {
                header: "Latest Activity",
                cell: (item) => (
                  <div className="text-[11px] text-gray-600 dark:text-gray-400">
                    {item.interviewDate ? (
                      <>
                        <span>{formatDate(item.interviewDate)}</span>
                        {item.interviewTime && (
                          <span className="ml-1 text-gray-400">
                            ({item.interviewTime})
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                ),
              },
              {
                header: "Interviewer",
                cell: (item) => (
                  <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                    {item.interviewer || "—"}
                  </span>
                ),
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (item) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {onScheduleCandidate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onScheduleCandidate({
                            name: item.name,
                            role: item.role,
                          })
                        }
                        className="h-8 gap-1 text-[11px]"
                        title="Schedule next interview round"
                      >
                        <Calendar className="h-3.5 w-3.5 text-brand-600" />
                        <span>Schedule</span>
                      </Button>
                    )}
                    {onGenerateOffer && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onGenerateOffer({
                            name: item.name,
                            role: item.role,
                          })
                        }
                        className="h-8 gap-1 text-[11px]"
                        title="Generate offer letter"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        <span>Offer</span>
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />

          {filtered.length > PAGE_SIZE && (
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
