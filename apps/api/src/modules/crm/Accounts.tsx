// CRM Core Domain — Accounts / Clients list. New top-nav tab, additive alongside the 9 existing
// sheet tabs. Each Account is a real relational record (`crm/accounts`), the parent for Contacts,
// Opportunities, Meetings, Follow-ups, Activities, Notes, Documents, Quotations and the unified
// Timeline — all managed from the Account 360 detail page (`AccountDetail.tsx`).
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Search,
  Users,
  Briefcase,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  deleteCrmAccount,
  deleteCrmAccountCascade,
} from "./domain/accountsService";
import { AccountFormDialog } from "./domain/AccountFormDialog";
import { STATUS_TAG_STYLE } from "./domain/StatusTagDialog";
import { usePagination, PaginationFooter } from "./components/Pagination";
import { isCrmAdmin } from "./domain/roles";
import { DeleteConfirmDialog, EmptyState } from "./intelligence/components";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import { ImportExportBar } from "./importExport/ImportExportBar";
import {
  FieldSchema,
  MappedImportRow,
  DuplicateStrategy,
} from "./importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "./importExport/commitHelpers";
import { CRM_ACCOUNTS_PATH } from "./domain/config";
import { CrmAccount } from "./domain/types";
import { computeAccountRelatedIds } from "./domain/relatedLookup";
import { useCrmCustomFields } from "./bulkImport/crmCustomFieldsService";

const ACCOUNT_IMPORT_EXPORT_FIELDS: FieldSchema<CrmAccount>[] = [
  {
    key: "name",
    label: "Account Name",
    required: true,
    aliases: ["Company Name", "Company", "Account"],
  },
  {
    key: "accountType",
    label: "Type",
    type: "select",
    options: ["Prospect", "Customer", "Partner", "Vendor", "Reseller"],
  },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "hq", label: "HQ" },
  { key: "phone", label: "Phone", aliases: ["Contact Number"] },
  { key: "email", label: "Email", type: "email" },
  { key: "ownerName", label: "Owner", aliases: ["Account Owner"] },
  { key: "registrationNumber", label: "Registration Number" },
  { key: "numberOfEmployees", label: "Number of Employees", type: "number" },
  { key: "annualRevenue", label: "Annual Revenue", type: "currency" },
  { key: "description", label: "Description" },
  { key: "billingStreet", label: "Billing Street" },
  { key: "billingCity", label: "Billing City" },
  { key: "billingState", label: "Billing State" },
  { key: "billingPostalCode", label: "Billing Postal Code" },
  { key: "billingCountry", label: "Billing Country" },
  { key: "shippingStreet", label: "Shipping Street" },
  { key: "shippingCity", label: "Shipping City" },
  { key: "shippingState", label: "Shipping State" },
  { key: "shippingPostalCode", label: "Shipping Postal Code" },
  { key: "shippingCountry", label: "Shipping Country" },
  {
    key: "customerCategory",
    label: "Customer Category",
    type: "select",
    options: ["Enterprise", "Mid-Market", "SMB", "Individual"],
  },
  {
    key: "customerClass",
    label: "Customer Class",
    type: "select",
    options: ["A", "B", "C"],
  },
  {
    key: "businessType",
    label: "Business Type",
    type: "select",
    options: [
      "Manufacturer",
      "Distributor",
      "Retailer",
      "Service Provider",
      "Reseller",
      "Other",
    ],
  },
  { key: "resellerType", label: "Reseller Type" },
  {
    key: "tags",
    label: "Tags (comma-separated)",
    exportValue: (r) => (r.tags || []).join(", "),
  },
];

export default function Accounts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const {
    accounts,
    contacts,
    opportunities,
    meetings,
    followUps,
    activities,
    quotations,
    documents,
    tasks,
    dealProducts,
    loading,
  } = useCrmDomainData();
  const customFieldDefs = useCrmCustomFields("accounts");

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.name, a.industry, a.ownerName, a.email]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  // Precomputed once (one pass each over contacts/opportunities) instead of every visible row
  // re-scanning the full contacts/opportunities arrays on every render — including every keystroke
  // in the search box above, since that re-renders the whole page even though `filtered`/`paged`
  // themselves stay memoized.
  const contactCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) =>
      map.set(c.accountId, (map.get(c.accountId) || 0) + 1),
    );
    return map;
  }, [contacts]);
  const opportunityCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    opportunities.forEach((o) =>
      map.set(o.accountId, (map.get(o.accountId) || 0) + 1),
    );
    return map;
  }, [opportunities]);

  const countsFor = (accountId: string) => ({
    contacts: contactCountByAccount.get(accountId) || 0,
    opportunities: opportunityCountByAccount.get(accountId) || 0,
  });

  const relatedFor = (accountId: string) =>
    computeAccountRelatedIds(accountId, {
      contacts,
      opportunities,
      meetings,
      followUps,
      activities,
      quotations,
      documents,
      tasks,
      dealProducts,
    });

  const commitAccountsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      CRM_ACCOUNTS_PATH,
      importRows,
      strategy,
      (row) => {
        const data = { ...row.data };
        if (typeof data.tags === "string")
          data.tags = (data.tags as string)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        if (row.isDuplicate && strategy === "update")
          return { ...data, updatedBy: currentUser, updatedAt: Date.now() };
        return { ...data, createdBy: currentUser, createdAt: Date.now() };
      },
    );
    await logBulkImportAudit("account", "Accounts", summary, currentUser);
    return summary;
  };

  const handleDeleteAccount = async (
    accountId: string,
    accountName: string,
  ) => {
    const related = relatedFor(accountId);
    const totalRelated = Object.values(related).reduce(
      (sum, ids) => sum + ids.length,
      0,
    );
    if (totalRelated > 0) {
      await deleteCrmAccountCascade(
        { id: accountId, name: accountName },
        related,
        user,
      );
    } else {
      await deleteCrmAccount(accountId, accountName, user);
    }
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
              <Building2 className="h-4 w-4 text-brand-600" /> Accounts /
              Clients
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Every company you're actively engaging with — Contacts,
              Opportunities, Meetings, and history live inside each Account.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              moduleLabel="Accounts"
              fields={ACCOUNT_IMPORT_EXPORT_FIELDS}
              allRecords={accounts}
              filteredRecords={filtered}
              fileBaseName="crm-accounts"
              duplicate={{
                keys: ["name"],
                findExisting: (mapped) => {
                  const name = String(mapped.name || "")
                    .trim()
                    .toLowerCase();
                  if (!name) return undefined;
                  const match = accounts.find(
                    (a) => a.name.trim().toLowerCase() === name,
                  );
                  return match
                    ? { id: match.id, label: match.name }
                    : undefined;
                },
              }}
              commitImport={commitAccountsImport}
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Accounts…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={query ? `No accounts match "${query}"` : "No accounts yet"}
              description="Create one, or convert a qualified Lead from the Leads tab."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Type
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Industry
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Owner
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Contacts
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Opportunities
                    </TableHead>
                    {customFieldDefs.map((d) => (
                      <TableHead
                        key={d.key}
                        className="font-black text-sm uppercase tracking-wider text-white py-2.5"
                      >
                        {d.label}
                      </TableHead>
                    ))}
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[210px] py-2.5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((a) => {
                    const c = countsFor(a.id);
                    return (
                      <TableRow
                        key={a.id}
                        className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
                        onClick={() => navigate(`/crm/accounts/${a.id}`)}
                      >
                        <TableCell className="py-1">
                          <p className="font-semibold text-slate-800">
                            {a.name}
                          </p>
                          {a.website && (
                            <p className="text-sm text-slate-400">
                              {a.website}
                            </p>
                          )}
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
                              className={cn(
                                "text-xs border",
                                STATUS_TAG_STYLE[a.statusTag],
                              )}
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
                            <Users className="h-3.5 w-3.5" /> {c.contacts}
                          </span>
                        </TableCell>
                        <TableCell className="py-1">
                          <span className="inline-flex items-center gap-1 text-base text-slate-600">
                            <Briefcase className="h-3.5 w-3.5" />{" "}
                            {c.opportunities}
                          </span>
                        </TableCell>
                        {customFieldDefs.map((d) => (
                          <TableCell
                            key={d.key}
                            className="py-1 text-base text-slate-600"
                          >
                            {a.customFields?.[d.key] || "—"}
                          </TableCell>
                        ))}
                        <TableCell
                          className="py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                              title="View account"
                              onClick={() => navigate(`/crm/accounts/${a.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                              title="Edit account"
                              onClick={() =>
                                navigate(`/crm/accounts/${a.id}`, {
                                  state: { openEdit: true },
                                })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            {isCrmAdmin(user) && (
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                    title="Delete account"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                }
                                title={`Delete "${a.name}"?`}
                                description="This account will be moved to the CRM Recycle Bin."
                                warning={
                                  c.contacts + c.opportunities > 0
                                    ? `This account has ${c.contacts} contact${c.contacts === 1 ? "" : "s"} and ${c.opportunities} opportunit${c.opportunities === 1 ? "y" : "ies"} — deleting it will also move all of their related meetings, follow-ups, activities, quotations, and documents to the Recycle Bin.`
                                    : undefined
                                }
                                confirmLabel={
                                  c.contacts + c.opportunities > 0
                                    ? "Delete Everything"
                                    : "Delete"
                                }
                                onConfirm={() =>
                                  handleDeleteAccount(a.id, a.name)
                                }
                              />
                            )}
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

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        currentUser={currentUser}
        existingAccounts={accounts}
        onSaved={(id) => navigate(`/crm/accounts/${id}`)}
      />
    </div>
  );
}
