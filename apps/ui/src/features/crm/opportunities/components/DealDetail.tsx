"use client";

// Deal (Opportunity) 360 detail page (legacy `DealDetail.tsx`). Stage transitions / Won / Lost /
// On Hold / Delete stay in `OpportunityDrawer` (opened here as "Manage Stage" in page mode); this
// page focuses on Products, Quotes, primary Contact / Role, the Activity log and Stage History.
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/legacy-ui/tabs";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
} from "@/features/crm/activities/hooks";
import { useContacts } from "@/features/crm/contacts/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import {
  useDeleteQuotation,
  useQuotations,
} from "@/features/crm/quotations/hooks";
import { usePermission } from "@/hooks/usePermission";
import { ACTIVITY_TYPES, type ActivityType } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  History,
  IndianRupee,
  ListChecks,
  Package,
  Plus,
  Receipt,
  Settings2,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { usePipelineStages } from "../../pipeline-stages/hooks";
import {
  useOpportunity,
  useOpportunityProducts,
  useRemoveOpportunityProduct,
  useStageHistory,
  useUpdateOpportunity,
} from "../hooks";
import {
  HEALTH_STYLE,
  OPPORTUNITY_WRITE_PERMS,
  STATUS_STYLE,
  computeExpectedRevenue,
  computeOpportunityHealth,
  currencySymbol,
  fmtIN,
  num,
} from "../pipelineConfig";
import { AddDealProductsDialog } from "./AddDealProductsDialog";
import { OpportunityDrawer } from "./OpportunityDrawer";

const TH = "font-black text-sm uppercase tracking-wider text-white py-2.5";
const TABLE_HEAD_BG =
  "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)";
const DEL_ICON_BTN =
  "h-8 w-8 p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg";

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-sm text-slate-700 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

const SECTION_TONE = {
  brand: {
    bar: "from-brand-400 to-brand-600",
    header: "from-brand-50/80 to-white",
  },
  blue: {
    bar: "from-blue-400 to-blue-600",
    header: "from-blue-50/80 to-white",
  },
} as const;

/** Legacy `SectionCard` (intelligence/components) — tinted header card used for each tab body. */
function SectionCard({
  icon: Icon,
  title,
  description,
  tone = "brand",
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: keyof typeof SECTION_TONE;
  action?: ReactNode;
  children: ReactNode;
}) {
  const v = SECTION_TONE[tone];
  return (
    <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
      <div aria-hidden className={cn("h-1 w-full bg-gradient-to-r", v.bar)} />
      <div
        className={cn(
          "crm-panel-header p-5 border-b border-slate-100 bg-gradient-to-br flex items-center justify-between gap-3",
          v.header,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-sm",
              v.bar,
            )}
          >
            <Icon className="h-4 w-4 text-white" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function DealDetail({ id }: { id: number }) {
  const router = useRouter();
  const canManage = usePermission(OPPORTUNITY_WRITE_PERMS);
  const canRemoveLine = usePermission("crm.opportunity.write.all");
  const canDeleteQuote = usePermission("crm.quotation.delete");
  const canDeleteActivity = usePermission("crm.activity.delete");
  const canLogActivity = usePermission("crm.activity.write");

  const oppQuery = useOpportunity(id);
  const stagesQuery = usePipelineStages();
  const productsQuery = useOpportunityProducts(id);
  const quotesQuery = useQuotations({ opportunityId: id, limit: 100 });
  const activitiesQuery = useActivities({
    relatedType: "opportunity",
    relatedId: id,
    limit: 100,
    order: "desc",
  });
  const historyQuery = useStageHistory(id);
  const opportunity = oppQuery.data;
  const contactsQuery = useContacts({
    accountId: opportunity?.accountId ?? 0,
    limit: 100,
  });

  const updateOpportunity = useUpdateOpportunity();
  const removeLine = useRemoveOpportunityProduct();
  const deleteQuotation = useDeleteQuotation();
  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [activityForm, setActivityForm] = useState<{
    type: ActivityType;
    subject: string;
    notes: string;
  }>({ type: "Call", subject: "", notes: "" });

  const stages = useMemo(() => stagesQuery.data ?? [], [stagesQuery.data]);
  const lineItems = useMemo(
    () => productsQuery.data ?? [],
    [productsQuery.data],
  );
  const quotations = quotesQuery.data?.data ?? [];
  const activities = activitiesQuery.data?.data ?? [];
  const stageHistory = historyQuery.data ?? [];
  const accountContacts = contactsQuery.data?.data ?? [];

  const productsSubtotal = useMemo(
    () => lineItems.reduce((sum, dp) => sum + num(dp.total), 0),
    [lineItems],
  );

  if (oppQuery.isPending)
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Loading Deal…
      </div>
    );

  if (!opportunity) {
    const noAccess =
      oppQuery.error instanceof ApiError && oppQuery.error.isPermissionError;
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
        <Briefcase className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">
          {noAccess ? "You don't have access to this deal" : "Deal not found"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 rounded-xl gap-1.5"
          onClick={() => router.push("/crm/pipeline")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Pipeline
        </Button>
      </div>
    );
  }

  const opp = opportunity;
  const sym = currencySymbol(opp.currency);
  const stageDef = stages.find((s) => s.id === opp.stageId);
  const health = computeOpportunityHealth(
    opp.stageEnteredAt,
    opp.status,
    stageDef?.slaDays,
  );
  const probability = opp.probability ?? stageDef?.probability ?? null;
  const expectedRevenue = computeExpectedRevenue(
    num(opp.estimatedValue),
    probability,
  );
  const primaryContact = accountContacts.find((c) => c.id === opp.contactId);

  const handleLogActivity = async () => {
    if (!activityForm.subject.trim()) return;
    try {
      await createActivity.mutateAsync({
        type: activityForm.type,
        relatedType: "opportunity",
        relatedId: id,
        subject: activityForm.subject.trim(),
        notes: activityForm.notes || undefined,
        occurredAt: new Date().toISOString(),
      });
      setActivityForm({ type: "Call", subject: "", notes: "" });
    } catch {
      toast.error("Failed to log activity");
    }
  };

  const patchOpportunity = async (
    input: Parameters<typeof updateOpportunity.mutateAsync>[0]["input"],
  ) => {
    try {
      await updateOpportunity.mutateAsync({ id, input });
    } catch {
      toast.error("Failed to update deal");
    }
  };

  const errMessage = (err: unknown, fallback: string) =>
    new Error(err instanceof ApiError ? err.message : fallback);

  if (drawerOpen) {
    return (
      <div className="space-y-6 pb-8">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => setDrawerOpen(false)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Deal
        </Button>
        <OpportunityDrawer
          opportunity={opp}
          accountName={opp.account.name}
          open={drawerOpen}
          onOpenChange={(o) => {
            setDrawerOpen(o);
          }}
          renderAs="page"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => router.push("/crm/pipeline")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Deals
        </Button>
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setDrawerOpen(true)}
        >
          <Settings2 className="h-3.5 w-3.5" /> Manage Stage / Won / Lost
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="p-3 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200 shrink-0">
              <Briefcase className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={cn("border", STATUS_STYLE[opp.status])}>
                  {opp.status.replace("_", " ")}
                </Badge>
                {opp.status === "OPEN" && (
                  <Badge className={cn("border", HEALTH_STYLE[health])}>
                    {health}
                  </Badge>
                )}
                {opp.opportunityNumber && (
                  <span className="text-sm text-slate-400">
                    {opp.opportunityNumber}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{opp.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
                <button
                  className="flex items-center gap-1 hover:text-brand-600"
                  onClick={() => router.push(`/crm/accounts/${opp.account.id}`)}
                >
                  <Building2 className="h-3 w-3" /> {opp.account.name}
                </button>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {opp.ownerName}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" /> {opp.stage.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              {sym}
              {fmtIN(opp.estimatedValue)}
            </p>
            <p className="text-sm text-slate-400">
              Expected Revenue {sym}
              {expectedRevenue.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max">
            <TabsTrigger value="overview" className="rounded-xl gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-xl gap-1.5">
              <Package className="h-3.5 w-3.5" /> Products ({lineItems.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="rounded-xl gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Quotes ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="contact" className="rounded-xl gap-1.5">
              <Users className="h-3.5 w-3.5" /> Contact &amp; Account
            </TabsTrigger>
            <TabsTrigger value="activities" className="rounded-xl gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Activities (
              {activitiesQuery.data?.meta.total ?? activities.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl gap-1.5">
              <History className="h-3.5 w-3.5" /> Stage History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-5">
            <div className="grid md:grid-cols-3 gap-4">
              <Field icon={Target} label="Stage" value={opp.stage.label} />
              <Field icon={User} label="Owner" value={opp.ownerName} />
              <Field
                icon={IndianRupee}
                label="Amount"
                value={`${sym}${fmtIN(opp.estimatedValue)}`}
              />
              <Field
                icon={CalendarClock}
                label="Expected Close Date"
                value={opp.expectedCloseDate?.slice(0, 10) ?? "—"}
              />
              <Field
                icon={TrendingUp}
                label="Probability"
                value={probability !== null ? `${probability}%` : "—"}
              />
              <Field
                icon={IndianRupee}
                label="Expected Revenue"
                value={`${sym}${expectedRevenue.toLocaleString("en-IN")}`}
              />
              <Field
                icon={User}
                label="Contact Role"
                value={opp.contactRole ?? "—"}
              />
              <Field
                icon={Target}
                label="Campaign Source"
                value={opp.campaignSource ?? "—"}
              />
              {opp.status === "OPEN" ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Forecast Category
                  </p>
                  <Select
                    value={opp.forecastCategory ?? ""}
                    onValueChange={(v) =>
                      void patchOpportunity({ forecastCategory: v })
                    }
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="Not categorized" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Best Case", "Commit", "Pipeline", "Omitted"].map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Field
                  icon={Target}
                  label="Forecast Category"
                  value={opp.forecastCategory ?? "—"}
                />
              )}
              <Field
                icon={CalendarClock}
                label="Created"
                value={new Date(opp.createdAt).toLocaleDateString("en-IN")}
              />
            </div>
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="mt-4">
          <SectionCard
            icon={Package}
            title="Deal Products"
            tone="brand"
            description={`${lineItems.length} product line item${lineItems.length === 1 ? "" : "s"} · Subtotal ₹${productsSubtotal.toLocaleString("en-IN")}`}
            action={
              canManage ? (
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setAddProductsOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Products
                </Button>
              ) : undefined
            }
          >
            {lineItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products added yet"
                description="Add products from the catalog to build this deal's line items."
              />
            ) : (
              <Table>
                <TableHeader className="text-white">
                  <TableRow
                    className="hover:bg-transparent border-none"
                    style={{ background: TABLE_HEAD_BG }}
                  >
                    <TableHead className={TH}>Product</TableHead>
                    <TableHead className={TH}>Qty</TableHead>
                    <TableHead className={TH}>Unit Price</TableHead>
                    <TableHead className={TH}>Discount</TableHead>
                    <TableHead className={TH}>Tax</TableHead>
                    <TableHead className={TH}>Total</TableHead>
                    <TableHead className={cn("w-10", TH)} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((dp) => (
                    <TableRow
                      key={dp.id}
                      className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                    >
                      <TableCell className="font-semibold text-slate-700 text-base py-1">
                        {dp.productName}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {num(dp.quantity)}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        ₹{fmtIN(dp.unitPrice)}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {num(dp.discountPercent)}%
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {num(dp.taxPercent)}%
                      </TableCell>
                      <TableCell className="text-base font-bold text-slate-800 py-1">
                        ₹{fmtIN(dp.total)}
                      </TableCell>
                      <TableCell className="text-base py-1">
                        {canRemoveLine && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Remove ${dp.productName}`}
                                className={DEL_ICON_BTN}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                            title="Remove this product from the deal?"
                            description={`"${dp.productName}" will be moved to the CRM Recycle Bin.`}
                            onConfirm={async () => {
                              try {
                                await removeLine.mutateAsync({
                                  opportunityId: id,
                                  itemId: dp.id,
                                });
                                toast.success("Product removed from deal");
                              } catch (err) {
                                throw errMessage(
                                  err,
                                  "Could not remove this product",
                                );
                              }
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* Quotes */}
        <TabsContent value="quotes" className="mt-4">
          <SectionCard
            icon={Receipt}
            title="Quotes"
            tone="brand"
            description={`${quotations.length} quote${quotations.length === 1 ? "" : "s"} for this deal`}
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() =>
                  router.push(
                    `/crm/quotes/new?dealId=${id}&accountId=${opp.accountId}`,
                  )
                }
              >
                <Plus className="h-3.5 w-3.5" /> New Quote
              </Button>
            }
          >
            {quotations.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No quotes yet"
                description="Create a quote to send pricing for this deal."
              />
            ) : (
              <Table>
                <TableHeader className="text-white">
                  <TableRow
                    className="hover:bg-transparent border-none"
                    style={{ background: TABLE_HEAD_BG }}
                  >
                    <TableHead className={TH}>Quote #</TableHead>
                    <TableHead className={TH}>Status</TableHead>
                    <TableHead className={TH}>Valid Until</TableHead>
                    <TableHead className={TH}>Amount</TableHead>
                    <TableHead className={cn("w-20", TH)} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      onClick={() => router.push(`/crm/quotes/${q.id}`)}
                    >
                      <TableCell className="font-semibold text-slate-700 text-base py-1">
                        {q.quotationNumber}
                      </TableCell>
                      <TableCell className="text-base py-1">
                        <Badge variant="outline" className="text-xs">
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {q.validUntil?.slice(0, 10) ?? "—"}
                      </TableCell>
                      <TableCell className="text-base font-bold text-slate-800 py-1">
                        {currencySymbol(q.currency)}
                        {fmtIN(q.grandTotal)}
                      </TableCell>
                      <TableCell
                        className="text-base py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canDeleteQuote && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete quote ${q.quotationNumber}`}
                                className={DEL_ICON_BTN}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                            title={`Delete quote ${q.quotationNumber}?`}
                            description="This quote and its line items will be moved to the CRM Recycle Bin."
                            onConfirm={async () => {
                              try {
                                await deleteQuotation.mutateAsync(q.id);
                                toast.success("Quote deleted");
                              } catch (err) {
                                throw errMessage(
                                  err,
                                  "Could not delete this quote",
                                );
                              }
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* Contact & Account */}
        <TabsContent value="contact" className="mt-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">
                  Primary Contact
                </label>
                <Select
                  value={opp.contactId ? String(opp.contactId) : ""}
                  onValueChange={(v) =>
                    void patchOpportunity({ contactId: Number(v) })
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountContacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.designation ? ` — ${c.designation}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">
                  Contact Role in Deal
                </label>
                <Input
                  key={id}
                  defaultValue={opp.contactRole ?? ""}
                  disabled={!canManage}
                  onBlur={(e) => {
                    if (e.target.value !== (opp.contactRole ?? ""))
                      void patchOpportunity({ contactRole: e.target.value });
                  }}
                  placeholder="e.g. Decision Maker"
                  className="h-9 rounded-xl"
                />
              </div>
            </div>
            {(primaryContact ?? opp.contact) && (
              <div className="rounded-2xl border border-slate-200/80 p-4 bg-slate-50/40 grid md:grid-cols-3 gap-3 text-sm">
                <Field
                  icon={User}
                  label="Name"
                  value={primaryContact?.name ?? opp.contact?.name ?? "—"}
                />
                <Field
                  icon={User}
                  label="Email"
                  value={primaryContact?.email ?? "—"}
                />
                <Field
                  icon={User}
                  label="Phone"
                  value={primaryContact?.phone ?? "—"}
                />
              </div>
            )}
            <button
              onClick={() => router.push(`/crm/accounts/${opp.account.id}`)}
              className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
            >
              <Building2 className="h-3.5 w-3.5" /> View full account —{" "}
              {opp.account.name}
            </button>
          </div>
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="mt-4">
          <SectionCard
            icon={ListChecks}
            title="Activity Log"
            tone="brand"
            description="Calls, emails, meetings, and notes logged against this deal"
          >
            {canLogActivity && (
              <div className="p-4 border-b border-slate-100 grid md:grid-cols-4 gap-2">
                <Select
                  value={activityForm.type}
                  onValueChange={(v) =>
                    setActivityForm((f) => ({ ...f, type: v as ActivityType }))
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={activityForm.subject}
                  onChange={(e) =>
                    setActivityForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  placeholder="Subject"
                  className="h-9 rounded-xl md:col-span-2"
                />
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  disabled={
                    !activityForm.subject.trim() || createActivity.isPending
                  }
                  onClick={() => void handleLogActivity()}
                >
                  <Plus className="h-3.5 w-3.5" /> Log Activity
                </Button>
                <Textarea
                  value={activityForm.notes}
                  onChange={(e) =>
                    setActivityForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Notes (optional)…"
                  className="rounded-xl text-sm md:col-span-4"
                  rows={2}
                />
              </div>
            )}
            {activities.length === 0 ? (
              <EmptyState icon={ListChecks} title="No activities logged yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {a.type} — {a.subject}
                      </p>
                      {a.notes && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {a.notes}
                        </p>
                      )}
                      <p className="text-sm text-slate-400 mt-1">
                        {new Date(a.occurredAt).toLocaleString()}
                      </p>
                    </div>
                    {canDeleteActivity && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete activity ${a.subject}`}
                            className={cn(DEL_ICON_BTN, "shrink-0")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                        title="Delete this activity?"
                        description={`"${a.subject}" will be moved to the CRM Recycle Bin.`}
                        onConfirm={async () => {
                          try {
                            await deleteActivity.mutateAsync(a.id);
                            toast.success("Activity deleted");
                          } catch (err) {
                            throw errMessage(
                              err,
                              "Could not delete this activity",
                            );
                          }
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Stage History */}
        <TabsContent value="history" className="mt-4">
          <SectionCard
            icon={History}
            title="Stage History"
            tone="blue"
            description="Every stage transition this deal has gone through"
          >
            {stageHistory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No stage changes recorded yet"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {stageHistory.map((h) => (
                  <div key={h.id} className="p-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {h.fromStage
                        ? `${h.fromStage.label} → ${h.toStage.label}`
                        : `Set to ${h.toStage.label}`}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {new Date(h.changedAt).toLocaleString()}
                      {h.changedByName ? ` · by ${h.changedByName}` : ""}
                    </p>
                    {h.remarks && (
                      <p className="text-sm text-slate-500 mt-1">{h.remarks}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <AddDealProductsDialog
        open={addProductsOpen}
        onOpenChange={setAddProductsOpen}
        opportunityId={id}
        opportunityTitle={opp.title}
      />
    </div>
  );
}
