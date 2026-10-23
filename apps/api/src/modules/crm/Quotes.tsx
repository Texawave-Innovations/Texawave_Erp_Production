// CRM Core Domain — global Quotes list. New top-nav tab, additive alongside Products/Contacts.
// Each row is a `crm/quotations` record; line items live under `crm/quotationItems/{id}` and are
// only loaded when a quote is opened for edit (`QuoteForm.tsx`), not in this list.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import { deleteCrmQuotation } from "./domain/quotationsService";
import { CrmQuotationStatus } from "./domain/types";
import { DeleteConfirmDialog, EmptyState } from "./intelligence/components";
import { isCrmAdmin } from "./domain/roles";
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
import { CRM_QUOTATIONS_PATH } from "./domain/config";
import { CrmAccount, CrmOpportunity, CrmQuotation } from "./domain/types";
import { QUOTATION_STATUS_STYLE, formatMoney } from "./domain/currency";
import { usePagination, PaginationFooter } from "./components/Pagination";
import { BackToDashboardButton } from "./components/BackToDashboardButton";

function buildQuoteFields(
  accounts: CrmAccount[],
  opportunities: CrmOpportunity[],
): FieldSchema<CrmQuotation>[] {
  return [
    {
      key: "quotationNumber",
      label: "Quote #",
      required: true,
      aliases: ["Quotation Number", "Quote Number"],
    },
    {
      key: "accountId",
      label: "Account",
      required: true,
      aliases: ["Account Name", "Company", "Company Name"],
      exportValue: (r) =>
        accounts.find((a) => a.id === r.accountId)?.name || "",
      relation: {
        label: "Account",
        required: true,
        lookup: (raw) =>
          accounts.find(
            (a) => a.name.trim().toLowerCase() === raw.trim().toLowerCase(),
          )?.id,
      },
    },
    {
      key: "opportunityId",
      label: "Deal",
      aliases: ["Opportunity", "Deal Name"],
      exportValue: (r) =>
        opportunities.find((o) => o.id === r.opportunityId)?.title || "",
      relation: {
        label: "Deal",
        lookup: (raw) =>
          opportunities.find(
            (o) => o.title.trim().toLowerCase() === raw.trim().toLowerCase(),
          )?.id,
      },
    },
    { key: "subject", label: "Subject" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Draft", "Sent", "Accepted", "Rejected", "Expired"],
    },
    { key: "validUntil", label: "Valid Until", type: "date" },
    { key: "quoteDate", label: "Quote Date", type: "date" },
    { key: "currency", label: "Currency" },
    { key: "amount", label: "Amount", required: true, type: "currency" },
    { key: "quoteOwner", label: "Quote Owner" },
    { key: "customerReference", label: "Customer Reference" },
    { key: "paymentTerms", label: "Payment Terms" },
    { key: "deliveryTerms", label: "Delivery Terms" },
    { key: "carrier", label: "Carrier" },
    { key: "notes", label: "Notes" },
  ];
}

const STATUS_STYLE = QUOTATION_STATUS_STYLE;

const formatQuoteAmount = formatMoney;

export default function Quotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, opportunities, quotations, loading } = useCrmDomainData();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmQuotationStatus | "ALL">(
    "ALL",
  );

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";
  const dealName = (id?: string) =>
    id ? opportunities.find((o) => o.id === id)?.title : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotations.filter((quote) => {
      if (statusFilter !== "ALL" && quote.status !== statusFilter) return false;
      if (!q) return true;
      return [
        quote.quotationNumber,
        quote.subject,
        accountName(quote.accountId),
      ]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q));
    });
  }, [quotations, query, statusFilter, accounts]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const quoteFields = useMemo(
    () => buildQuoteFields(accounts, opportunities),
    [accounts, opportunities],
  );

  const commitQuotesImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      CRM_QUOTATIONS_PATH,
      importRows,
      strategy,
      (row) => {
        const data = {
          ...row.data,
          amount: Number(row.data.amount) || 0,
          status: row.data.status || "Draft",
          currency: row.data.currency || "INR",
        };
        if (row.isDuplicate && strategy === "update")
          return { ...data, updatedAt: Date.now() };
        return { ...data, createdBy: currentUser, createdAt: Date.now() };
      },
    );
    await logBulkImportAudit("quotation", "Quotes", summary, currentUser);
    return summary;
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
              <Receipt className="h-4 w-4 text-brand-600" /> Quotes
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Every quote sent to a prospect — line items, totals, and status.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as CrmQuotationStatus | "ALL")
              }
            >
              <SelectTrigger className="h-9 rounded-xl w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {(
                  [
                    "Draft",
                    "Sent",
                    "Accepted",
                    "Rejected",
                    "Expired",
                  ] as CrmQuotationStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search quotes…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              moduleLabel="Quotes"
              fields={quoteFields}
              allRecords={quotations}
              filteredRecords={filtered}
              fileBaseName="crm-quotes"
              helperNote="Bulk Import creates quote header details only (account, amount, status, terms). Line items are not supported here — open the quote afterward to add products, so existing quote/line-item data is never corrupted."
              duplicate={{
                keys: ["quotationNumber"],
                findExisting: (mapped) => {
                  const num = String(mapped.quotationNumber || "")
                    .trim()
                    .toLowerCase();
                  if (!num) return undefined;
                  const match = quotations.find(
                    (q) => q.quotationNumber.trim().toLowerCase() === num,
                  );
                  return match
                    ? { id: match.id, label: match.quotationNumber }
                    : undefined;
                },
              }}
              commitImport={commitQuotesImport}
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => navigate("/crm/quotes/new")}
            >
              <Plus className="h-4 w-4" /> New Quote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Quotes…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={query ? `No quotes match "${query}"` : "No quotes yet"}
              description="Create a quote from here, or from a Deal's Quotes tab."
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
                      Quote #
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Deal
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Valid Until
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Grand Total
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[220px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
                      onClick={() => navigate(`/crm/quotes/${quote.id}/edit`)}
                    >
                      <TableCell className="py-1">
                        <p className="font-semibold text-slate-800">
                          {quote.quotationNumber}
                        </p>
                        {quote.subject && (
                          <p className="text-sm text-slate-400">
                            {quote.subject}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        <div className="flex items-center justify-center gap-1">
                          {accountName(quote.accountId)}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {dealName(quote.opportunityId) || "—"}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge
                          variant="outline"
                          className={`border ${STATUS_STYLE[quote.status]}`}
                        >
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {quote.validUntil || "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base font-bold text-slate-800">
                        {formatQuoteAmount(
                          quote.grandTotal ?? quote.amount,
                          quote.currency,
                        )}
                      </TableCell>
                      <TableCell
                        className="py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                            title="View quote"
                            onClick={() =>
                              navigate(`/crm/quotes/${quote.id}/edit`)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                            title="Edit quote"
                            onClick={() =>
                              navigate(`/crm/quotes/${quote.id}/edit`)
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
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title={`Delete quote ${quote.quotationNumber}?`}
                              description="This quote and its line items will be moved to the CRM Recycle Bin."
                              onConfirm={() =>
                                deleteCrmQuotation(
                                  quote.id,
                                  quote.quotationNumber,
                                  user,
                                )
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
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
    </div>
  );
}
