// CRM Core Domain — shared operational-queue view for the Interested / Not Interested /
// Keep in Touch / Call Back-Send Info tabs. Each of these tabs is a filtered, read/write view
// over the same `crm/accounts` Core Domain records (filtered by `statusTag`) rather than its own
// independent dataset — so changing an Account's status anywhere (here, the Account 360 page, or
// the Accounts list) instantly moves it between these tabs with no duplicate record ever created.
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Search, Eye, CheckCircle2, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { celebrateCrm } from "../celebration";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./useCrmDomainData";
import { StatusTagDialog, STATUS_TAG_STYLE } from "./StatusTagDialog";
import { setCrmTaskStatus } from "./tasksService";
import { usePagination, PaginationFooter } from "../components/Pagination";
import { EmptyState } from "../intelligence/components";
import { BackToDashboardButton } from "../components/BackToDashboardButton";
import { CrmAccount, CrmStatusTag } from "./types";

function statusDetail(a: CrmAccount): string {
  if (a.statusTag === "Not Interested") return a.statusReason || "—";
  if (a.statusTag === "Keep in Touch" || a.statusTag === "Call Back")
    return a.statusDate ? new Date(a.statusDate).toLocaleString() : "—";
  if (a.statusTag === "Send Info") return a.statusInfoType || "—";
  return "—";
}

export function AccountStatusQueue({
  tags,
  title,
  description,
  icon: Icon,
}: {
  /** One or more `CrmStatusTag`s this queue shows — e.g. `['Interested']` or
   *  `['Call Back', 'Send Info']` for the combined Call Back-Send Info tab. */
  tags: CrmStatusTag[];
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, contacts, opportunities, tasks, activities, loading } =
    useCrmDomainData();
  const [query, setQuery] = useState("");
  const accountViewState = { from: location.pathname, label: title };

  const records = useMemo(() => {
    return accounts
      .filter((a) => a.statusTag && tags.includes(a.statusTag))
      .map((a) => {
        const accountContacts = contacts.filter((c) => c.accountId === a.id);
        const primaryContact =
          accountContacts.find((c) => c.isPrimary) || accountContacts[0];
        const accountOpportunities = opportunities.filter(
          (o) => o.accountId === a.id,
        );
        const openOpportunity = accountOpportunities
          .filter((o) => o.status === "OPEN")
          .sort((x, y) => (y.estimatedValue || 0) - (x.estimatedValue || 0))[0];
        const relevantIds = new Set([
          a.id,
          ...accountContacts.map((c) => c.id),
          ...accountOpportunities.map((o) => o.id),
        ]);
        const relatedActivities = activities.filter((act) =>
          relevantIds.has(act.relatedId),
        );
        const lastTouchAt = relatedActivities.length
          ? Math.max(...relatedActivities.map((act) => act.occurredAt))
          : undefined;
        const accountOpenTasks = tasks.filter(
          (t) => t.relatedId === a.id && t.status === "Open",
        );
        return {
          account: a,
          primaryContact,
          openOpportunity,
          lastTouchAt,
          openTask: accountOpenTasks[0],
          accountOpenTasks,
        };
      })
      .sort(
        (x, y) =>
          (y.account.statusUpdatedAt || 0) - (x.account.statusUpdatedAt || 0),
      );
  }, [accounts, contacts, opportunities, activities, tasks, tags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [
        r.account.name,
        r.account.ownerName,
        r.primaryContact?.name,
        r.account.statusReason,
        r.account.statusInfoType,
      ]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [records, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

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
              <Icon className="h-4 w-4 text-brand-600" /> {title}
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              {description}
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
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading {title}…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={
                query
                  ? `No records match "${query}"`
                  : `No accounts in ${title}`
              }
              description="Accounts appear here automatically when their status is changed from the Account page — nothing is entered separately here."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table className="table-fixed min-w-[1180px]">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[11%]" />
                  <col className="w-[9%]" />
                  {tags.length > 1 && <col className="w-[8%]" />}
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[300px]" />
                </colgroup>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Contact
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Owner
                    </TableHead>
                    {tags.length > 1 && (
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                        Type
                      </TableHead>
                    )}
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Detail
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Opportunity
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Last Touch
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Task
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center py-2.5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map(
                    ({
                      account: a,
                      primaryContact,
                      openOpportunity,
                      lastTouchAt,
                      openTask,
                      accountOpenTasks,
                    }) => (
                      <TableRow
                        key={a.id}
                        className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      >
                        <TableCell
                          className="cursor-pointer text-center align-middle py-1"
                          onClick={() =>
                            navigate(`/crm/accounts/${a.id}`, {
                              state: accountViewState,
                            })
                          }
                        >
                          <p className="font-semibold text-slate-800 truncate">
                            {a.name}
                          </p>
                          {a.industry && (
                            <p className="text-sm text-slate-400 truncate">
                              {a.industry}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 text-center align-middle truncate py-1">
                          {primaryContact?.name || "—"}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 text-center align-middle truncate py-1">
                          {a.ownerName || "—"}
                        </TableCell>
                        {tags.length > 1 && (
                          <TableCell className="text-center align-middle py-1">
                            <div className="flex justify-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs border",
                                  STATUS_TAG_STYLE[a.statusTag!],
                                )}
                              >
                                {a.statusTag}
                              </Badge>
                            </div>
                          </TableCell>
                        )}
                        <TableCell
                          className="text-base text-slate-600 text-center align-middle py-1"
                          title={statusDetail(a)}
                        >
                          <div className="max-w-full truncate mx-auto">
                            {statusDetail(a)}
                          </div>
                        </TableCell>
                        <TableCell className="text-base text-slate-600 text-center align-middle py-1">
                          {openOpportunity ? (
                            <div className="flex flex-col items-center">
                              <p className="font-medium text-slate-700 truncate max-w-full">
                                {openOpportunity.title}
                              </p>
                              <p className="text-sm text-slate-400">
                                ₹
                                {openOpportunity.estimatedValue.toLocaleString(
                                  "en-IN",
                                )}
                              </p>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 text-center align-middle py-1">
                          {lastTouchAt
                            ? new Date(lastTouchAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 text-center align-middle py-1">
                          {openTask ? (
                            <div className="flex justify-center">
                              <Badge
                                variant="outline"
                                className="text-xs whitespace-nowrap"
                              >
                                Due {openTask.dueDate}
                              </Badge>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className="align-middle py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs rounded-lg whitespace-nowrap border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                              onClick={() =>
                                navigate(`/crm/accounts/${a.id}`, {
                                  state: accountViewState,
                                })
                              }
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {openTask && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                                onClick={() =>
                                  setCrmTaskStatus(
                                    openTask.id,
                                    "Completed",
                                    currentUser,
                                    openTask.title,
                                  ).then(() =>
                                    celebrateCrm(
                                      a.statusTag === "Send Info"
                                        ? "sendInfo.completed"
                                        : "task.completed",
                                    ),
                                  )
                                }
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                                {a.statusTag === "Send Info"
                                  ? "Mark Sent"
                                  : "Complete"}
                              </Button>
                            )}
                            <StatusTagDialog
                              account={a}
                              currentUser={currentUser}
                              openTasks={accountOpenTasks}
                              trigger={
                                <Button
                                  size="sm"
                                  className="h-8 px-2 gap-1 text-xs rounded-lg whitespace-nowrap"
                                >
                                  Change Status
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
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
