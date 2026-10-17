"use client";

// Shared operational-queue view for Interested / Not Interested / Keep in Touch / Call Back-Send
// Info — port of legacy `domain/AccountStatusQueue.tsx`. Each queue is a filtered, live view over
// the same `Account.statusTag` field the Accounts list and Account page write, so changing status
// anywhere moves the account between queues automatically.
import type { Account, AccountStatusTag } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { CheckCircle2, Eye, Search, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
import { cn } from "@/components/legacy-ui/utils";
import { useActivities } from "@/features/crm/activities/hooks";
import { celebrateCrm } from "@/features/crm/celebration";
import { useContacts } from "@/features/crm/contacts/hooks";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import {
  PaginationFooter,
  usePagination,
} from "@/features/crm/legacy-ui/Pagination";
import { useOpportunities } from "@/features/crm/opportunities/hooks";
import {
  useCrmTasks,
  useUpdateCrmTaskStatus,
} from "@/features/crm/tasks/hooks";
import { useAccounts, useChangeAccountStatusTag } from "../hooks";
import { formatRupees, STATUS_TAG_STYLE, TABLE_HEAD_STYLE } from "./accountUi";
import { StatusTagDialog } from "./StatusTagDialog";

/** API caps `limit` at 100. The `statusTag` filter on `GET /crm/accounts` takes one tag, so the
 * combined Call Back / Send Info queue merges two single-tag fetches and pages client-side. */
const FETCH_LIMIT = 100;

const TH =
  "font-black text-sm uppercase tracking-wider text-white text-center py-2.5";

function statusDetail(a: Account): string {
  if (a.statusTag === "Not Interested") return a.statusReason || "—";
  if (a.statusTag === "Keep in Touch" || a.statusTag === "Call Back") {
    return a.statusDate ? new Date(a.statusDate).toLocaleString() : "—";
  }
  if (a.statusTag === "Send Info") return a.statusInfoType || "—";
  return "—";
}

function QueueRow({
  account: a,
  showType,
  viewHref,
  onChangeStatus,
  onOpen,
}: {
  account: Account;
  showType: boolean;
  viewHref: string;
  onChangeStatus: (a: Account) => void;
  onOpen: (href: string) => void;
}) {
  const contactsQuery = useContacts({ accountId: a.id, limit: 50 });
  const oppsQuery = useOpportunities({
    accountId: a.id,
    status: "OPEN",
    limit: 50,
  });
  const tasksQuery = useCrmTasks({
    relatedType: "account",
    relatedId: a.id,
    status: "Open",
    limit: 20,
  });
  const activitiesQuery = useActivities({
    accountId: a.id,
    limit: 1,
    order: "desc",
  });
  const updateTaskStatus = useUpdateCrmTaskStatus();

  const contacts = contactsQuery.data?.data ?? [];
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const openOpportunity = [...(oppsQuery.data?.data ?? [])].sort(
    (x, y) => Number(y.estimatedValue) - Number(x.estimatedValue),
  )[0];
  const openTask = tasksQuery.data?.data[0];
  const lastTouch = activitiesQuery.data?.data[0]?.occurredAt;
  const detail = statusDetail(a);

  async function completeTask() {
    if (!openTask) return;
    try {
      await updateTaskStatus.mutateAsync({
        id: openTask.id,
        input: { status: "Completed" },
      });
      celebrateCrm(
        a.statusTag === "Send Info" ? "sendInfo.completed" : "task.completed",
      );
    } catch {
      toast.error("Could not update the task. Please try again.");
    }
  }

  return (
    <TableRow className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40">
      <TableCell
        className="cursor-pointer text-center align-middle py-1"
        onClick={() => onOpen(viewHref)}
      >
        <p className="font-semibold text-slate-800 truncate">{a.name}</p>
        {a.industry && (
          <p className="text-sm text-slate-400 truncate">{a.industry}</p>
        )}
      </TableCell>
      <TableCell className="text-base text-slate-600 text-center align-middle truncate py-1">
        {primaryContact?.name || "—"}
      </TableCell>
      <TableCell className="text-base text-slate-600 text-center align-middle truncate py-1">
        {a.ownerName || "—"}
      </TableCell>
      {showType && (
        <TableCell className="text-center align-middle py-1">
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={cn(
                "text-xs border",
                a.statusTag ? STATUS_TAG_STYLE[a.statusTag] : undefined,
              )}
            >
              {a.statusTag}
            </Badge>
          </div>
        </TableCell>
      )}
      <TableCell
        className="text-base text-slate-600 text-center align-middle py-1"
        title={detail}
      >
        <div className="max-w-full truncate mx-auto">{detail}</div>
      </TableCell>
      <TableCell className="text-base text-slate-600 text-center align-middle py-1">
        {openOpportunity ? (
          <div className="flex flex-col items-center">
            <p className="font-medium text-slate-700 truncate max-w-full">
              {openOpportunity.title}
            </p>
            <p className="text-sm text-slate-400">
              {formatRupees(openOpportunity.estimatedValue)}
            </p>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-base text-slate-600 text-center align-middle py-1">
        {lastTouch ? new Date(lastTouch).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="text-base text-slate-600 text-center align-middle py-1">
        {openTask ? (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              Due {openTask.dueDate}
            </Badge>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="align-middle py-1">
        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 gap-1 text-xs rounded-lg whitespace-nowrap border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
            onClick={() => onOpen(viewHref)}
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
          {openTask && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 gap-1 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
              disabled={updateTaskStatus.isPending}
              onClick={() => void completeTask()}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />{" "}
              {a.statusTag === "Send Info" ? "Mark Sent" : "Complete"}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 px-2 gap-1 text-xs rounded-lg whitespace-nowrap"
            onClick={() => onChangeStatus(a)}
          >
            Change Status
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export interface AccountStatusQueueListProps {
  /** One or two `AccountStatusTag`s this queue shows — e.g. `["Interested"]` or
   * `["Call Back", "Send Info"]` for the combined queue. */
  tags:
    readonly [AccountStatusTag] | readonly [AccountStatusTag, AccountStatusTag];
  title: string;
  description: string;
  icon: LucideIcon;
}

export function AccountStatusQueueList({
  tags,
  title,
  description,
  icon: Icon,
}: AccountStatusQueueListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [statusTagTarget, setStatusTagTarget] = useState<Account | null>(null);
  const changeStatusTag = useChangeAccountStatusTag();

  const primaryTag = tags[0];
  const secondaryTag = tags[1];
  const isCombined = secondaryTag !== undefined;

  // Hook count must be fixed — always call both; ignore the second when single-tag.
  const queryA = useAccounts({
    statusTag: primaryTag,
    page: 1,
    limit: FETCH_LIMIT,
  });
  const queryB = useAccounts({
    statusTag: secondaryTag ?? primaryTag,
    page: 1,
    limit: FETCH_LIMIT,
  });

  const loading = queryA.isPending || (isCombined && queryB.isPending);
  const isError = queryA.isError || (isCombined && queryB.isError);
  const firstError = queryA.error ?? queryB.error;

  const records = useMemo(() => {
    const rowsA = queryA.data?.data ?? [];
    const rowsB = isCombined ? (queryB.data?.data ?? []) : [];
    const byId = new Map<number, Account>();
    for (const a of [...rowsA, ...rowsB]) byId.set(a.id, a);
    return Array.from(byId.values()).sort(
      (x, y) =>
        new Date(y.statusUpdatedAt ?? 0).getTime() -
        new Date(x.statusUpdatedAt ?? 0).getTime(),
    );
  }, [queryA.data, queryB.data, isCombined]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((a) =>
      [a.name, a.ownerName, a.statusReason, a.statusInfoType]
        .filter((f): f is string => Boolean(f))
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [records, search]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const viewHref = (a: Account) =>
    `/crm/accounts/${a.id}?back=${encodeURIComponent(pathname)}&backLabel=${encodeURIComponent(title)}`;

  const permissionDenied =
    isError && firstError instanceof ApiError && firstError.isPermissionError;

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          ) : permissionDenied ? (
            <EmptyState
              icon={Icon}
              title="You don't have access to CRM accounts"
              description="Ask an administrator for the crm.account.read permission."
            />
          ) : isError ? (
            <div className="text-center py-16 text-sm text-slate-500">
              Could not load {title}.{" "}
              <button
                type="button"
                className="text-brand-600 hover:underline"
                onClick={() => {
                  void queryA.refetch();
                  if (isCombined) void queryB.refetch();
                }}
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={
                search
                  ? `No records match "${search}"`
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
                  {isCombined && <col className="w-[8%]" />}
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[300px]" />
                </colgroup>
                <TableHeader style={TABLE_HEAD_STYLE}>
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={TH}>Account</TableHead>
                    <TableHead className={TH}>Contact</TableHead>
                    <TableHead className={TH}>Owner</TableHead>
                    {isCombined && <TableHead className={TH}>Type</TableHead>}
                    <TableHead className={TH}>Detail</TableHead>
                    <TableHead className={TH}>Opportunity</TableHead>
                    <TableHead className={TH}>Last Touch</TableHead>
                    <TableHead className={TH}>Task</TableHead>
                    <TableHead className={TH}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((a) => (
                    <QueueRow
                      key={a.id}
                      account={a}
                      showType={isCombined}
                      viewHref={viewHref(a)}
                      onChangeStatus={setStatusTagTarget}
                      onOpen={(href) => router.push(href)}
                    />
                  ))}
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

      <StatusTagDialog
        open={statusTagTarget !== null}
        onClose={() => setStatusTagTarget(null)}
        currentStatusTag={statusTagTarget?.statusTag}
        onSubmit={async (values) => {
          if (!statusTagTarget) return;
          await changeStatusTag.mutateAsync({
            id: statusTagTarget.id,
            input: values,
          });
          toast.success("Status tag updated");
        }}
      />
    </div>
  );
}
