"use client";

import type { CrmTask, FollowUp, Meeting } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { useAccounts } from "@/features/crm/accounts/hooks";
import { useContacts } from "@/features/crm/contacts/hooks";
import { useOpportunities } from "@/features/crm/opportunities/hooks";
import {
  useFollowUps,
  useUpdateFollowUpStatus,
} from "@/features/crm/follow-ups/hooks";
import {
  useMeetings,
  useUpdateMeetingStatus,
} from "@/features/crm/meetings/hooks";
import {
  useCrmTasks,
  useUpdateCrmTaskStatus,
} from "@/features/crm/tasks/hooks";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/** Large bound, same reasoning as AccountStatusQueueList's FETCH_LIMIT — a
 * single bounded fetch per entity kind plus client-side filtering, rather
 * than threading real cross-entity pagination through 3 independent lists
 * merged by due date. */
const FETCH_LIMIT = 200;

type Kind = "Task" | "Follow-up" | "Meeting";
type SubTab = "all" | "Follow-up" | "Task" | "Meeting";

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
  onComplete: () => void;
  onCancel?: (() => void) | undefined;
}

function isOverdue(dueDate: string): boolean {
  const d = new Date(dueDate);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

/** Upcoming/pending Tasks (Open), Follow-ups (PENDING/OVERDUE), and Meetings
 * (not COMPLETED/CANCELLED) across every Account — mirrors legacy
 * TexaWave_ERP/src/modules/crm/YetToHappen.tsx. Org-wide listing already
 * works on the existing `GET /crm/tasks|follow-ups|meetings` endpoints by
 * simply omitting `relatedId` (the repositories' `filterWhere` only adds
 * that clause `if (filter.relatedId !== undefined)` — see
 * apps/api/src/modules/crm/{tasks,follow-ups,meetings}.repository.ts), so
 * no backend change was needed for this queue. */
export function YetToHappenList() {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("all");

  const tasksQuery = useCrmTasks({ status: "Open", limit: FETCH_LIMIT });
  const followUpsQuery = useFollowUps({ limit: FETCH_LIMIT });
  const meetingsQuery = useMeetings({ limit: FETCH_LIMIT });
  // Best-effort name resolution only — a user without crm.contact.read /
  // crm.opportunity.read can still use this queue; those rows simply show
  // without a resolvable Account name/link (see fallback below).
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

  const accountByContactId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const c of contactsQuery.data?.data ?? []) map.set(c.id, c.account);
    return map;
  }, [contactsQuery.data]);

  const accountByOpportunityId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const o of opportunitiesQuery.data?.data ?? [])
      map.set(o.id, o.account);
    return map;
  }, [opportunitiesQuery.data]);

  function resolveAccount(relatedType: string, relatedId: number) {
    if (relatedType === "account") {
      const name = accountNameById.get(relatedId);
      return name ? { id: relatedId, name } : undefined;
    }
    if (relatedType === "contact") return accountByContactId.get(relatedId);
    if (relatedType === "opportunity")
      return accountByOpportunityId.get(relatedId);
    return undefined;
  }

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];

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
        onComplete: () => {
          updateTaskStatus.mutate(
            { id: t.id, input: { status: "Completed" } },
            {
              onSuccess: () =>
                toast({ title: "Task completed", variant: "success" }),
              onError: () =>
                toast({ title: "Failed to complete task", variant: "error" }),
            },
          );
        },
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
        onComplete: () => {
          updateFollowUpStatus.mutate(
            { id: f.id, input: { status: "COMPLETED" } },
            {
              onSuccess: () =>
                toast({ title: "Follow-up completed", variant: "success" }),
              onError: () =>
                toast({
                  title: "Failed to complete follow-up",
                  variant: "error",
                }),
            },
          );
        },
        onCancel: () => {
          updateFollowUpStatus.mutate(
            { id: f.id, input: { status: "CANCELLED" } },
            {
              onError: () =>
                toast({
                  title: "Failed to cancel follow-up",
                  variant: "error",
                }),
            },
          );
        },
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
        onComplete: () => {
          updateMeetingStatus.mutate(
            { id: m.id, input: { status: "COMPLETED" } },
            {
              onSuccess: () =>
                toast({ title: "Meeting completed", variant: "success" }),
              onError: () =>
                toast({
                  title: "Failed to complete meeting",
                  variant: "error",
                }),
            },
          );
        },
        onCancel: () => {
          updateMeetingStatus.mutate(
            { id: m.id, input: { status: "CANCELLED" } },
            {
              onError: () =>
                toast({ title: "Failed to cancel meeting", variant: "error" }),
            },
          );
        },
      });
    }

    return list
      .map((r) => {
        const account = resolveAccount(r.relatedType, r.relatedId);
        return { ...r, accountId: account?.id, accountName: account?.name };
      })
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveAccount closes over the memoized maps above
  }, [
    tasksQuery.data,
    followUpsQuery.data,
    meetingsQuery.data,
    accountNameById,
    accountByContactId,
    accountByOpportunityId,
    updateTaskStatus,
    updateFollowUpStatus,
    updateMeetingStatus,
    toast,
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

  const byTab = useMemo(
    () => (subTab === "all" ? rows : rows.filter((r) => r.kind === subTab)),
    [rows, subTab],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((r) =>
      [r.accountName, r.owner, r.action]
        .filter((f): f is string => Boolean(f))
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [byTab, query]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Yet to Happen
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Upcoming tasks, follow-ups, and meetings across every account.
          Completing or cancelling one removes it from this queue.
        </p>
      </div>

      <Tabs
        label="Yet to Happen sections"
        idPrefix="yth"
        value={subTab}
        onChange={setSubTab}
        tabs={[
          { id: "all", label: `All (${counts.all})` },
          { id: "Follow-up", label: `Follow-ups (${counts["Follow-up"]})` },
          { id: "Task", label: `Tasks (${counts.Task})` },
          { id: "Meeting", label: `Meetings (${counts.Meeting})` },
        ]}
      />

      <Input
        placeholder="Search by account, owner, or action..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        firstError instanceof ApiError && firstError.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to this queue">
            Ask an administrator for the <code>crm.task.read</code>,{" "}
            <code>crm.followup.read</code>, and <code>crm.meeting.read</code>{" "}
            permissions.
          </Alert>
        ) : (
          <ErrorState
            onRetry={() => {
              void tasksQuery.refetch();
              void followUpsQuery.refetch();
              void meetingsQuery.refetch();
            }}
          />
        )
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={query ? `No records match "${query}"` : "Nothing upcoming"}
            description="Future tasks, follow-ups, and meetings scheduled against any Account will appear here."
          />
        </Card>
      ) : (
        <DataTable<Row>
          columns={[
            {
              header: "Account",
              cell: (r) =>
                r.accountId ? (
                  <button
                    type="button"
                    className="text-left text-brand-600 hover:underline dark:text-brand-400"
                    onClick={() => router.push(`/crm/accounts/${r.accountId}`)}
                  >
                    {r.accountName}
                  </button>
                ) : (
                  "—"
                ),
            },
            { header: "Owner", cell: (r) => r.owner || "—" },
            { header: "Action", cell: (r) => r.action },
            {
              header: "Type",
              cell: (r) => <StatusBadge label={r.kind} colorToken="gray" />,
            },
            {
              header: "Due Date",
              cell: (r) => (
                <StatusBadge
                  label={
                    r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"
                  }
                  colorToken={isOverdue(r.dueDate) ? "error" : "gray"}
                />
              ),
            },
            { header: "Priority", cell: (r) => r.priority ?? "—" },
            {
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  {r.accountId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/crm/accounts/${r.accountId}`)
                      }
                    >
                      View
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={r.onComplete}>
                    Complete
                  </Button>
                  {r.onCancel ? (
                    <Button variant="ghost" size="sm" onClick={r.onCancel}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={filtered}
          getRowKey={(r) => r.id}
        />
      )}
    </div>
  );
}
