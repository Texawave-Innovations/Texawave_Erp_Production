// Fourth tab of the CRM module — Yet to Happen. Shows every future CRM action — Open tasks,
// pending/overdue follow-ups, and not-yet-completed meetings — drawn live from the Core CRM
// domain data (`crm/tasks`, `crm/followups`, `crm/meetings`), joined back to their owning
// Account/Contact/Opportunity. Nothing is entered separately here: completing or cancelling the
// underlying task/follow-up/meeting (from here or the Account page) removes it from this queue.
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  CalendarClock,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { celebrateCrm } from "./celebration";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import { getEffectiveFollowUpStatus } from "./domain/config";
import { setCrmTaskStatus } from "./domain/tasksService";
import { updateCrmFollowUpStatus } from "./domain/followupsService";
import { updateCrmMeetingStatus } from "./domain/meetingsService";
import { resolveAccountId } from "./domain/relatedLookup";
import { usePagination, PaginationFooter } from "./components/Pagination";
import { EmptyState } from "./intelligence/components";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import { CrmRelatedType } from "./domain/types";

interface YetToHappenItem {
  id: string;
  kind: "Task" | "Follow-up" | "Meeting";
  action: string;
  dueDate: string;
  owner: string;
  priority?: string;
  relatedType: CrmRelatedType;
  relatedId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

const VALID_SUB_TABS = ["all", "Follow-up", "Task", "Meeting"] as const;
type SubTab = (typeof VALID_SUB_TABS)[number];

export default function YetToHappen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const {
    accounts,
    contacts,
    opportunities,
    tasks,
    followUps,
    meetings,
    loading,
  } = useCrmDomainData();
  const [query, setQuery] = useState("");
  const requestedSubTab = (location.state as { subTab?: string } | null)
    ?.subTab;
  const initialSubTab: SubTab = VALID_SUB_TABS.includes(
    requestedSubTab as SubTab,
  )
    ? (requestedSubTab as SubTab)
    : "all";
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);

  const items = useMemo<YetToHappenItem[]>(() => {
    const list: YetToHappenItem[] = [];

    tasks
      .filter((t) => t.status === "Open")
      .forEach((t) =>
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
            setCrmTaskStatus(t.id, "Completed", currentUser, t.title)
              .then(() => celebrateCrm("task.completed"))
              .catch((err) => {
                console.error("Failed to complete task:", err);
                toast.error("Failed to complete task. Please try again.");
              }),
        }),
      );

    followUps
      .filter((f) =>
        ["PENDING", "OVERDUE"].includes(getEffectiveFollowUpStatus(f)),
      )
      .forEach((f) =>
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
            updateCrmFollowUpStatus(f.id, "COMPLETED", currentUser)
              .then(() => celebrateCrm("followup.completed"))
              .catch((err) => {
                console.error("Failed to complete follow-up:", err);
                toast.error("Failed to complete follow-up. Please try again.");
              }),
          onCancel: () =>
            updateCrmFollowUpStatus(f.id, "CANCELLED", currentUser).catch(
              (err) => {
                console.error("Failed to cancel follow-up:", err);
                toast.error("Failed to cancel follow-up. Please try again.");
              },
            ),
        }),
      );

    meetings
      .filter((m) => !["COMPLETED", "CANCELLED"].includes(m.status))
      .forEach((m) =>
        list.push({
          id: `meeting_${m.id}`,
          kind: "Meeting",
          action: `${m.mode} meeting`,
          dueDate: m.date,
          owner: m.participants || "—",
          relatedType: m.relatedType,
          relatedId: m.relatedId,
          onComplete: () =>
            updateCrmMeetingStatus(m.id, "COMPLETED", currentUser)
              .then(() => celebrateCrm("meeting.completed"))
              .catch((err) => {
                console.error("Failed to complete meeting:", err);
                toast.error("Failed to complete meeting. Please try again.");
              }),
          onCancel: () =>
            updateCrmMeetingStatus(m.id, "CANCELLED", currentUser).catch(
              (err) => {
                console.error("Failed to cancel meeting:", err);
                toast.error("Failed to cancel meeting. Please try again.");
              },
            ),
        }),
      );

    return list.sort((a, b) =>
      (a.dueDate || "").localeCompare(b.dueDate || ""),
    );
  }, [tasks, followUps, meetings, currentUser]);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const accountId = resolveAccountId(
        item.relatedType,
        item.relatedId,
        contacts,
        opportunities,
      );
      const account = accounts.find((a) => a.id === accountId);
      const contact =
        item.relatedType === "contact"
          ? contacts.find((c) => c.id === item.relatedId)
          : undefined;
      const opportunity =
        item.relatedType === "opportunity"
          ? opportunities.find((o) => o.id === item.relatedId)
          : undefined;
      return { ...item, account, contact, opportunity };
    });
  }, [items, accounts, contacts, opportunities]);

  const counts = useMemo(
    () => ({
      all: enriched.length,
      "Follow-up": enriched.filter((r) => r.kind === "Follow-up").length,
      Task: enriched.filter((r) => r.kind === "Task").length,
      Meeting: enriched.filter((r) => r.kind === "Meeting").length,
    }),
    [enriched],
  );

  const byType = useMemo(() => {
    if (subTab === "all") return enriched;
    return enriched.filter((r) => r.kind === subTab);
  }, [enriched, subTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter((r) =>
      [
        r.account?.name,
        r.contact?.name,
        r.opportunity?.title,
        r.owner,
        r.action,
      ]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [byType, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const isOverdue = (dueDate: string) => {
    const d = new Date(dueDate);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  };

  const getViewPath = (item: (typeof enriched)[number]) => {
    if (item.account) return `/crm/accounts/${item.account.id}`;
    if (item.relatedType === "lead") return `/crm/leads/${item.relatedId}`;
    return undefined;
  };

  const accountViewState = {
    from: "/crm/yet-to-happen",
    label: "Yet to Happen",
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
          <Tabs
            value={subTab}
            onValueChange={(v) => setSubTab(v as typeof subTab)}
          >
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
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Contact / Deal
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Owner
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Action
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Type
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Due Date
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Priority
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center px-3 py-2.5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((item) => {
                    const viewPath = getViewPath(item);
                    return (
                      <TableRow
                        key={item.id}
                        className="border-b border-brand-200 hover:bg-brand-50/40"
                      >
                        <TableCell
                          className={`px-3 py-1 text-center align-middle truncate ${item.account ? "cursor-pointer" : ""}`}
                          onClick={() =>
                            item.account &&
                            navigate(`/crm/accounts/${item.account.id}`, {
                              state: accountViewState,
                            })
                          }
                        >
                          {item.account?.name || "—"}
                        </TableCell>
                        <TableCell className="px-3 py-1 text-center align-middle truncate text-base text-slate-600">
                          {item.contact?.name || item.opportunity?.title || "—"}
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
                            {item.dueDate || "—"}
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
                              onClick={() =>
                                viewPath &&
                                navigate(
                                  viewPath,
                                  item.account
                                    ? { state: accountViewState }
                                    : undefined,
                                )
                              }
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
