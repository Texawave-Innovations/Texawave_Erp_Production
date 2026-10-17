"use client";

// Accounts / Clients list — port of legacy `Accounts.tsx`.
import type { Account, CrmCustomFieldDef } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Briefcase,
  Building2,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { useContacts } from "@/features/crm/contacts/hooks";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { useOpportunities } from "@/features/crm/opportunities/hooks";
import { usePermission } from "@/hooks/usePermission";
import { useAccounts, useDeleteAccount } from "../hooks";
import {
  CRM_DELETE_BTN_CLASS,
  EDIT_BTN_CLASS,
  STATUS_TAG_STYLE,
  TABLE_HEAD_STYLE,
  TH_CLASS,
  VIEW_BTN_CLASS,
} from "./accountUi";

/** One table row. Contacts/Opportunities counts come from the two scoped list endpoints
 * (`meta.total`), so the row owns the queries it needs for its count cells + delete warning. */
function AccountRow({
  account: a,
  customFieldDefs,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: {
  account: Account;
  customFieldDefs: CrmCustomFieldDef[];
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const contactsQuery = useContacts({ accountId: a.id, limit: 1 });
  const oppsQuery = useOpportunities({ accountId: a.id, limit: 1 });
  const contactCount = contactsQuery.data?.meta.total ?? 0;
  const oppCount = oppsQuery.data?.meta.total ?? 0;

  return (
    <TableRow
      className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
      onClick={onOpen}
    >
      <TableCell className="py-1">
        <p className="font-semibold text-slate-800">{a.name}</p>
        {a.website && <p className="text-sm text-slate-400">{a.website}</p>}
      </TableCell>
      <TableCell className="py-1">
        {a.accountType ? (
          <Badge variant="outline" className="text-xs">
            {a.accountType}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="py-1">
        {a.statusTag ? (
          <Badge
            variant="outline"
            className={cn("text-xs border", STATUS_TAG_STYLE[a.statusTag])}
          >
            {a.statusTag}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="py-1 text-base text-slate-600">
        {a.industry || "—"}
      </TableCell>
      <TableCell className="py-1 text-base text-slate-600">
        {a.ownerName || "—"}
      </TableCell>
      <TableCell className="py-1">
        <span className="inline-flex items-center gap-1 text-base text-slate-600">
          <Users className="h-3.5 w-3.5" /> {contactCount}
        </span>
      </TableCell>
      <TableCell className="py-1">
        <span className="inline-flex items-center gap-1 text-base text-slate-600">
          <Briefcase className="h-3.5 w-3.5" /> {oppCount}
        </span>
      </TableCell>
      {customFieldDefs.map((d) => (
        <TableCell key={d.key} className="py-1 text-base text-slate-600">
          {a.customFields?.[d.key] || "—"}
        </TableCell>
      ))}
      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className={VIEW_BTN_CLASS}
            title="View account"
            onClick={onOpen}
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={EDIT_BTN_CLASS}
            title="Edit account"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {canDelete && (
            <DeleteConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className={CRM_DELETE_BTN_CLASS}
                  title="Delete account"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              }
              title={`Delete "${a.name}"?`}
              description="This account will be moved to the CRM Recycle Bin."
              warning={
                contactCount + oppCount > 0
                  ? `This account has ${contactCount} contact${contactCount === 1 ? "" : "s"} and ${oppCount} opportunit${oppCount === 1 ? "y" : "ies"} — deleting it will also move all of their related meetings, follow-ups, activities, tasks, notes, quotations, and documents to the Recycle Bin.`
                  : undefined
              }
              confirmLabel={
                contactCount + oppCount > 0 ? "Delete Everything" : "Delete"
              }
              onConfirm={onDelete}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AccountList() {
  const router = useRouter();
  const canDelete = usePermission("crm.account.delete");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deleteMutation = useDeleteAccount();
  const customFieldDefs = useCustomFields("accounts").data ?? [];

  const accountsQuery = useAccounts({
    page,
    limit: pageSize,
    search: query.trim() || undefined,
  });
  const rows = accountsQuery.data?.data ?? [];
  const meta = accountsQuery.data?.meta;

  async function handleDelete(account: Account) {
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success(`Deleted "${account.name}"`);
    } catch {
      throw new Error("Failed to delete — please try again.");
    }
  }

  const permissionDenied =
    accountsQuery.isError &&
    accountsQuery.error instanceof ApiError &&
    accountsQuery.error.isPermissionError;

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
              <Building2 className="h-4 w-4 text-brand-600" /> Accounts /
              Clients
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Every company you&apos;re actively engaging with — Contacts,
              Opportunities, Meetings, and history live inside each Account.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search accounts…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              entity="accounts"
              moduleLabel="Accounts"
              fileBaseName="crm-accounts"
              search={query}
              customModule="accounts"
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => router.push("/crm/accounts/new")}
            >
              <Plus className="h-4 w-4" /> Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accountsQuery.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Accounts…
            </div>
          ) : permissionDenied ? (
            <EmptyState
              icon={Building2}
              title="You don't have access to CRM accounts"
              description="Ask an administrator for the crm.account.read permission."
            />
          ) : accountsQuery.isError ? (
            <div className="text-center py-16 text-sm text-slate-500">
              Could not load accounts.{" "}
              <button
                type="button"
                className="text-brand-600 hover:underline"
                onClick={() => void accountsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={query ? `No accounts match "${query}"` : "No accounts yet"}
              description="Create one, or convert a qualified Lead from the Leads tab."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader style={TABLE_HEAD_STYLE}>
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={TH_CLASS}>Account</TableHead>
                    <TableHead className={TH_CLASS}>Type</TableHead>
                    <TableHead className={TH_CLASS}>Status</TableHead>
                    <TableHead className={TH_CLASS}>Industry</TableHead>
                    <TableHead className={TH_CLASS}>Owner</TableHead>
                    <TableHead className={TH_CLASS}>Contacts</TableHead>
                    <TableHead className={TH_CLASS}>Opportunities</TableHead>
                    {customFieldDefs.map((d) => (
                      <TableHead key={d.key} className={TH_CLASS}>
                        {d.label}
                      </TableHead>
                    ))}
                    <TableHead
                      className={cn(TH_CLASS, "text-center w-[210px]")}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      customFieldDefs={customFieldDefs}
                      canDelete={canDelete}
                      onOpen={() => router.push(`/crm/accounts/${a.id}`)}
                      onEdit={() => router.push(`/crm/accounts/${a.id}?edit=1`)}
                      onDelete={() => handleDelete(a)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={meta?.page ?? page}
            setPage={(updater) => setPage(updater)}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={Math.max(1, meta?.totalPages ?? 1)}
            total={meta?.total ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
