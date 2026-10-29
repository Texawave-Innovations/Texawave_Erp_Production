"use client";

import type { CrmTask, FollowUp, Meeting } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Search,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/legacy-ui/tabs";
import { useAccounts } from "@/features/crm/accounts/hooks";
import { celebrateCrm } from "@/features/crm/celebration";
import { useContacts } from "@/features/crm/contacts/hooks";
import {
  useFollowUps,
  useUpdateFollowUpStatus,
} from "@/features/crm/follow-ups/hooks";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import {
  PaginationFooter,
  usePagination,
} from "@/features/crm/legacy-ui/Pagination";
import {
  useMeetings,
  useUpdateMeetingStatus,
} from "@/features/crm/meetings/hooks";
import { useOpportunities } from "@/features/crm/opportunities/hooks";
import {
  useCrmTasks,
  useUpdateCrmTaskStatus,
} from "@/features/crm/tasks/hooks";

/** Large bound — a single bounded fetch per entity kind plus client-side
 * filtering/pagination (same approach as AccountStatusQueueList), rather than
 * threading cross-entity pagination through 3 independent lists merged by due
 * date. Capped at the API's MAX_PAGE_SIZE (100) — anything higher gets
 * rejected with a 400, which previously broke every query on this page. */
const FETCH_LIMIT = 100;

type Kind = "Task" | "Follow-up" | "Meeting";
type SubTab = "all" | Kind;

interface Row {
  id: string;
  kind: Kind;
  action: string;
  dueDate: string;
  owner: string;
  priority?: string | null;
  relatedType: string;
  relatedId: number;
  accountId?: number | undefined;
  accountName?: string | undefined;
  contactName?: string | undefined;
  opportunityTitle?: string | undefined;
  onComplete: () => void;
  onCancel?: (() => void) | undefined;
}

function isOverdue(dueDate: string): boolean {
  const d = new Date(dueDate);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

const dueLabel = (dueDate: string) =>
  /^\d{4}-\d{2}-\d{2}T/.test(dueDate) ? dueDate.slice(0, 10) : dueDate;

const SUB_TABS: readonly SubTab[] = ["all", "Follow-up", "Task", "Meeting"];

const HEAD =
  "font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5";

/** Legacy YetToHappen.tsx: upcoming/pending Tasks (Open), Follow-ups
 * (PENDING/OVERDUE) and Meetings (not COMPLETED/CANCELLED) across every
 * Account / Contact / Opportunity / Lead. Completing or cancelling one removes
 * it from the queue. Org-wide listing uses the existing list endpoints with
 * `relatedId` omitted, so no backend change was needed. */
export function YetToHappenList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Legacy opened a sub-tab via navigation state; here it is `?subTab=`.
  const requestedSubTab = useSearchParams().get("subTab") as SubTab | null;
  const [subTab, setSubTab] = useState<SubTab>(
    requestedSubTab && SUB_TABS.includes(requestedSubTab)
      ? requestedSubTab
      : "all",
  );

  const tasksQuery = useCrmTasks({ status: "Open", limit: FETCH_LIMIT });
  const followUpsQuery = useFollowUps({ limit: FETCH_LIMIT });
  const meetingsQuery = useMeetings({ limit: FETCH_LIMIT });
  // Best-effort name resolution only — a user without crm.contact.read /
  // crm.opportunity.read can still use this queue; those rows simply show
  // without a resolvable name/link.
  const accountsQuery = useAccounts({ limit: FETCH_LIMIT });
  const contactsQuery = useContacts({ limit: FETCH_LIMIT });
  const opportunitiesQuery = useOpportunities({ limit: FETCH_LIMIT });

  const updateTaskStatus = useUpdateCrmTaskStatus();
  const updateFollowUpStatus = useUpdateFollowUpStatus();
  const updateMeetingStatus = useUpdateMeetingStatus();

  const loading =
    tasksQuery.isPending || followUpsQuery.isPending || meetingsQuery.isPending;
  const isError =
    tasksQuery.isError || followUpsQuery.isError || meetingsQuery.isError;
  const firstError =
    tasksQuery.error ?? followUpsQuery.error ?? meetingsQuery.error;

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accountsQuery.data?.data ?? []) map.set(a.id, a.name);
    return map;
  }, [accountsQuery.data]);

  const contactById = useMemo(() => {
    const map = new Map<
      number,
      { name: string; account: { id: number; name: string } }
    >();
    for (const c of contactsQuery.data?.data ?? [])
      map.set(c.id, { name: c.name, account: c.account });
    return map;
  }, [contactsQuery.data]);

  const opportunityById = useMemo(() => {
    const map = new Map<
      number,
      { title: string; account: { id: number; name: string } }
    >();
    for (const o of opportunitiesQuery.data?.data ?? [])
      map.set(o.id, { title: o.title, account: o.account });
    return map;
  }, [opportunitiesQuery.data]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const fail = (what: string) => () =>
      toast.error(`Failed to ${what}. Please try again.`);

    for (const t of (tasksQuery.data?.data ?? []) as CrmTask[]) {
      list.push({
        id: `task_${t.id}`,
        kind: "Task",
        action: t.title,
        dueDate: t.dueDate,
        owner: t.assignedTo,
        priority: t.priority,
        relatedType: t.relatedType,
        relatedId: t.relatedId,
        onComplete: () =>
          updateTaskStatus.mutate(
            { id: t.id, input: { status: "Completed" } },
            {
              onSuccess: () => celebrateCrm("task.completed"),
              onError: fail("complete task"),
            },
          ),
      });
    }

    for (const f of (followUpsQuery.data?.data ?? []) as FollowUp[]) {
      if (f.effectiveStatus !== "PENDING" && f.effectiveStatus !== "OVERDUE")
        continue;
      list.push({
        id: `followup_${f.id}`,
        kind: "Follow-up",
        action: `${f.type} follow-up`,
        dueDate: f.scheduledAt,
        owner: f.assignedTo,
        priority: f.priority,
        relatedType: f.relatedType,
        relatedId: f.relatedId,
        onComplete: () =>
          updateFollowUpStatus.mutate(
            { id: f.id, input: { status: "COMPLETED" } },
            {
              onSuccess: () => celebrateCrm("followup.completed"),
              onError: fail("complete follow-up"),
            },
          ),
        onCancel: () =>
          updateFollowUpStatus.mutate(
            { id: f.id, input: { status: "CANCELLED" } },
            { onError: fail("cancel follow-up") },
          ),
      });
    }

    for (const m of (meetingsQuery.data?.data ?? []) as Meeting[]) {
      if (m.status === "COMPLETED" || m.status === "CANCELLED") continue;
      list.push({
        id: `meeting_${m.id}`,
        kind: "Meeting",
        action: `${m.mode} meeting`,
        dueDate: m.meetingDate,
        owner: m.participants || "—",
        relatedType: m.relatedType,
        relatedId: m.relatedId,
        onComplete: () =>
          updateMeetingStatus.mutate(
            { id: m.id, input: { status: "COMPLETED" } },
            {
              onSuccess: () => celebrateCrm("meeting.completed"),
              onError: fail("complete meeting"),
            },
          ),
        onCancel: () =>
          updateMeetingStatus.mutate(
            { id: m.id, input: { status: "CANCELLED" } },
            { onError: fail("cancel meeting") },
          ),
      });
    }

    return list
      .map((r) => {
        let account: { id: number; name: string } | undefined;
        let contactName: string | undefined;
        let opportunityTitle: string | undefined;
        if (r.relatedType === "account") {
          const name = accountNameById.get(r.relatedId);
          account = name ? { id: r.relatedId, name } : undefined;
        } else if (r.relatedType === "contact") {
          const c = contactById.get(r.relatedId);
          account = c?.account;
          contactName = c?.name;
        } else if (r.relatedType === "opportunity") {
          const o = opportunityById.get(r.relatedId);
          account = o?.account;
          opportunityTitle = o?.title;
        }
        return {
          ...r,
          accountId: account?.id,
          accountName: account?.name,
          contactName,
          opportunityTitle,
        };
      })
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [
    tasksQuery.data,
    followUpsQuery.data,
    meetingsQuery.data,
    accountNameById,
    contactById,
    opportunityById,
    updateTaskStatus,
    updateFollowUpStatus,
    updateMeetingStatus,
  ]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      "Follow-up": rows.filter((r) => r.kind === "Follow-up").length,
      Task: rows.filter((r) => r.kind === "Task").length,
      Meeting: rows.filter((r) => r.kind === "Meeting").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const byTab =
      subTab === "all" ? rows : rows.filter((r) => r.kind === subTab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((r) =>
      [r.accountName, r.contactName, r.opportunityTitle, r.owner, r.action]
        .filter((f): f is string => Boolean(f))
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [rows, subTab, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const viewPathOf = (r: Row): string | undefined => {
    if (r.accountId) return `/crm/accounts/${r.accountId}`;
    if (r.relatedType === "lead") return `/crm/leads/${r.relatedId}`;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-600" /> Yet to Happen
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Upcoming tasks, follow-ups, and meetings — live from Core CRM.
              Completing or cancelling one removes it from this queue.
            </CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
            />
          </div>
        </CardHeader>
        <div className="px-5 pt-4 pb-1 border-b border-slate-100 bg-slate-50/30">
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
            <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max [&_[data-state=inactive]]:text-slate-700">
              <TabsTrigger value="all" className="rounded-xl gap-1.5">
                All ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="Follow-up" className="rounded-xl gap-1.5">
                Follow-ups ({counts["Follow-up"]})
              </TabsTrigger>
              <TabsTrigger value="Task" className="rounded-xl gap-1.5">
                Tasks ({counts.Task})
              </TabsTrigger>
              <TabsTrigger value="Meeting" className="rounded-xl gap-1.5">
                Meetings ({counts.Meeting})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Yet to Happen…
            </div>
          ) : isError ? (
            <div className="text-center py-16 text-sm text-red-600">
              {firstError instanceof ApiError && firstError.isPermissionError
                ? "You don't have access to this queue (needs crm.task.read, crm.followup.read and crm.meeting.read)."
                : "Could not load Yet to Happen."}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title={query ? `No records match "${query}"` : "Nothing upcoming"}
              description="Future tasks, follow-ups, and meetings scheduled against any Account, Contact, or Opportunity will appear here."
            />
          ) : (
            <div className="w-full overflow-x-auto crm-tracker-scroll">
              <Table className="table-fixed min-w-[1190px]">
                <colgroup>
                  <col className="w-[150px]" />
                  <col className="w-[170px]" />
                  <col className="w-[120px]" />
                  <col className="w-[170px]" />
                  <col className="w-[90px]" />
                  <col className="w-[130px]" />
                  <col className="w-[90px]" />
                  <col className="w-[270px]" />
                </colgroup>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={HEAD}>Account</TableHead>
                    <TableHead className={HEAD}>Contact / Deal</TableHead>
                    <TableHead className={HEAD}>Owner</TableHead>
                    <TableHead className={HEAD}>Action</TableHead>
                    <TableHead className={HEAD}>Type</TableHead>
                    <TableHead className={HEAD}>Due Date</TableHead>
                    <TableHead className={HEAD}>Priority</TableHead>
                    <TableHead className={HEAD}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((item) => {
                    const viewPath = viewPathOf(item);
                    return (
                      <TableRow
                        key={item.id}
                        className="border-b border-brand-200 hover:bg-brand-50/40"
                      >
                        <TableCell
                          className={`px-3 py-1 text-center align-middle truncate ${item.accountId ? "cursor-pointer" : ""}`}
                          onClick={() =>
                            item.accountId &&
                            router.push(`/crm/accounts/${item.accountId}`)
                          }
                        >
                          {item.accountName || "—"}
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle truncate text-base text-slate-600">
                          {item.contactName || item.opportunityTitle || "—"}
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle truncate text-base text-slate-600">
                          {item.owner || "—"}
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle truncate text-base text-slate-600">
                          {item.action}
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle">
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            {item.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle">
                          <Badge
                            variant="outline"
                            className={
                              isOverdue(item.dueDate)
                                ? "bg-red-50 hover:bg-red-50 text-red-700 border-red-200 text-xs border whitespace-nowrap"
                                : "bg-slate-100 hover:bg-slate-100 text-slate-600 border-slate-200 text-xs border whitespace-nowrap"
                            }
                          >
                            {item.dueDate ? dueLabel(item.dueDate) : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle text-base text-slate-600">
                          {item.priority || "—"}
                        </TableCell>
                        <TableCell
                          className="px-2 py-1 text-center align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1 flex-nowrap whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!viewPath}
                              className="h-8 px-2 gap-1 text-xs rounded-lg shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 disabled:opacity-40 disabled:pointer-events-none"
                              onClick={() => viewPath && router.push(viewPath)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
                              onClick={item.onComplete}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!item.onCancel}
                              className="h-8 px-2 gap-1 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                              onClick={item.onCancel}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
