// CRM Core Domain — Deal (Opportunity) 360 detail page. New page, additive alongside the Kanban
// board (`Pipeline.tsx`) and the quick-glance `OpportunityDrawer`. Stage transitions/Won/Lost/
// On-Hold/Delete all stay in `OpportunityDrawer` (opened here as "Manage Stage") rather than
// being duplicated — this page focuses on the content the drawer has no room for: Products,
// Quotes, primary Contact/Role, and a full-width Activities log + Stage History timeline.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  liveStageLabel as stageLabel,
  useCrmPipelineStages,
} from "./domain/pipelineStagesService";
import {
  computeExpectedRevenue,
  computeOpportunityHealth,
  ACTIVITY_TYPES,
} from "./domain/config";
import {
  updateCrmOpportunity,
  subscribeCrmStageHistory,
} from "./domain/opportunitiesService";
import { removeCrmDealProduct } from "./domain/dealProductsService";
import { deleteCrmQuotation } from "./domain/quotationsService";
import { logCrmActivity, deleteCrmActivity } from "./domain/activitiesService";
import { OpportunityDrawer } from "./domain/OpportunityDrawer";
import { AddDealProductsDialog } from "./domain/AddDealProductsDialog";
import { CrmActivityType, CrmStageHistoryEntry } from "./domain/types";
import {
  DeleteConfirmDialog,
  EmptyState,
  SectionCard,
} from "./intelligence/components";
import { isCrmAdmin } from "./domain/roles";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
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

export default function DealDetail() {
  const { opportunityId = "" } = useParams<{ opportunityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";

  const {
    accounts,
    contacts,
    opportunities,
    products,
    dealProducts,
    quotations,
    activities,
    loading,
  } = useCrmDomainData();
  const { stages } = useCrmPipelineStages();
  const opportunity = opportunities.find((o) => o.id === opportunityId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [activityForm, setActivityForm] = useState<{
    type: CrmActivityType;
    subject: string;
    notes: string;
  }>({ type: "Call", subject: "", notes: "" });
  const [loggingActivity, setLoggingActivity] = useState(false);
  const [stageHistory, setStageHistory] = useState<CrmStageHistoryEntry[]>([]);

  const account = accounts.find((a) => a.id === opportunity?.accountId);
  const accountContacts = useMemo(
    () => contacts.filter((c) => c.accountId === opportunity?.accountId),
    [contacts, opportunity?.accountId],
  );
  const dealLineItems = useMemo(
    () => dealProducts.filter((dp) => dp.opportunityId === opportunityId),
    [dealProducts, opportunityId],
  );
  const dealQuotations = useMemo(
    () => quotations.filter((q) => q.opportunityId === opportunityId),
    [quotations, opportunityId],
  );
  const dealActivities = useMemo(
    () =>
      activities
        .filter((a) => a.relatedId === opportunityId)
        .sort((a, b) => b.occurredAt - a.occurredAt),
    [activities, opportunityId],
  );

  useEffect(() => {
    if (!opportunityId) return undefined;
    return subscribeCrmStageHistory(opportunityId, setStageHistory);
  }, [opportunityId]);

  const productsSubtotal = useMemo(
    () => dealLineItems.reduce((sum, dp) => sum + dp.total, 0),
    [dealLineItems],
  );

  if (loading)
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Loading Deal…
      </div>
    );

  if (!opportunity) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
        <Briefcase className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">Deal not found</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 rounded-xl gap-1.5"
          onClick={() => navigate("/crm/pipeline")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Pipeline
        </Button>
      </div>
    );
  }

  const stageDef = stages.find((s) => s.id === opportunity.stage);
  const health = computeOpportunityHealth(
    opportunity.stageEnteredAt,
    opportunity.status,
    stageDef?.slaDays,
  );
  const expectedRevenue = computeExpectedRevenue(
    opportunity.estimatedValue,
    opportunity.probability ?? stageDef?.probability,
  );
  const primaryContact = contacts.find((c) => c.id === opportunity.contactId);

  const handleLogActivity = async () => {
    if (!activityForm.subject.trim()) return;
    setLoggingActivity(true);
    try {
      await logCrmActivity({
        type: activityForm.type,
        relatedType: "opportunity",
        relatedId: opportunityId,
        subject: activityForm.subject,
        notes: activityForm.notes || undefined,
        occurredAt: Date.now(),
        createdBy: currentUser,
      });
      setActivityForm({ type: "Call", subject: "", notes: "" });
    } catch (err) {
      console.error("Failed to log activity:", err);
    } finally {
      setLoggingActivity(false);
    }
  };

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
          opportunity={opportunity}
          accountName={account?.name}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          currentUser={currentUser}
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
          onClick={() => navigate("/crm/pipeline")}
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
                <Badge
                  className={cn("border", STATUS_STYLE[opportunity.status])}
                >
                  {opportunity.status.replace("_", " ")}
                </Badge>
                {opportunity.status === "OPEN" && (
                  <Badge
                    className={cn(
                      "border",
                      health === "Healthy"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : health === "Delayed"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200",
                    )}
                  >
                    {health}
                  </Badge>
                )}
                {opportunity.opportunityNumber && (
                  <span className="text-sm text-slate-400">
                    {opportunity.opportunityNumber}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {opportunity.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
                {account && (
                  <button
                    className="flex items-center gap-1 hover:text-brand-600"
                    onClick={() => navigate(`/crm/accounts/${account.id}`)}
                  >
                    <Building2 className="h-3 w-3" /> {account.name}
                  </button>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {opportunity.ownerName}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" /> {stageLabel(opportunity.stage)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              ₹{opportunity.estimatedValue.toLocaleString("en-IN")}
            </p>
            <p className="text-sm text-slate-400">
              Expected Revenue ₹{expectedRevenue.toLocaleString("en-IN")}
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
              <Package className="h-3.5 w-3.5" /> Products (
              {dealLineItems.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="rounded-xl gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Quotes (
              {dealQuotations.length})
            </TabsTrigger>
            <TabsTrigger value="contact" className="rounded-xl gap-1.5">
              <Users className="h-3.5 w-3.5" /> Contact & Account
            </TabsTrigger>
            <TabsTrigger value="activities" className="rounded-xl gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Activities (
              {dealActivities.length})
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
              <Field
                icon={Target}
                label="Stage"
                value={stageLabel(opportunity.stage)}
              />
              <Field icon={User} label="Owner" value={opportunity.ownerName} />
              <Field
                icon={IndianRupee}
                label="Amount"
                value={
                  opportunity.estimatedValue != null
                    ? `₹${opportunity.estimatedValue.toLocaleString("en-IN")}`
                    : "—"
                }
              />
              <Field
                icon={CalendarClock}
                label="Expected Close Date"
                value={opportunity.expectedCloseDate || "—"}
              />
              <Field
                icon={TrendingUp}
                label="Probability"
                value={
                  (opportunity.probability ?? stageDef?.probability) != null
                    ? `${opportunity.probability ?? stageDef?.probability}%`
                    : "—"
                }
              />
              <Field
                icon={IndianRupee}
                label="Expected Revenue"
                value={`₹${expectedRevenue.toLocaleString("en-IN")}`}
              />
              <Field
                icon={User}
                label="Contact Role"
                value={opportunity.contactRole || "—"}
              />
              <Field
                icon={Target}
                label="Campaign Source"
                value={opportunity.campaignSource || "—"}
              />
              <Field
                icon={CalendarClock}
                label="Created"
                value={new Date(opportunity.createdAt).toLocaleDateString(
                  "en-IN",
                )}
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
            description={`${dealLineItems.length} product line item${dealLineItems.length === 1 ? "" : "s"} · Subtotal ₹${productsSubtotal.toLocaleString("en-IN")}`}
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setAddProductsOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add Products
              </Button>
            }
          >
            {dealLineItems.length === 0 ? (
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
                    style={{
                      background:
                        "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                  >
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Product
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Qty
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Unit Price
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Discount
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Tax
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Total
                    </TableHead>
                    <TableHead className="w-10 font-black text-sm uppercase tracking-wider text-white py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealLineItems.map((dp) => (
                    <TableRow
                      key={dp.id}
                      className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                    >
                      <TableCell className="font-semibold text-slate-700 text-base py-1">
                        {dp.productName}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {dp.quantity}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        ₹{dp.unitPrice.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {dp.discountPercent || 0}%
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {dp.taxPercent || 0}%
                      </TableCell>
                      <TableCell className="text-base font-bold text-slate-800 py-1">
                        ₹{dp.total.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-base py-1">
                        {isCrmAdmin(user) && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                            title="Remove this product from the deal?"
                            description={`"${dp.productName}" will be moved to the CRM Recycle Bin.`}
                            onConfirm={() =>
                              removeCrmDealProduct(dp.id, dp.productName, user)
                            }
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
            description={`${dealQuotations.length} quote${dealQuotations.length === 1 ? "" : "s"} for this deal`}
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() =>
                  navigate(
                    `/crm/quotes/new?dealId=${opportunityId}&accountId=${opportunity.accountId}`,
                  )
                }
              >
                <Plus className="h-3.5 w-3.5" /> New Quote
              </Button>
            }
          >
            {dealQuotations.length === 0 ? (
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
                    style={{
                      background:
                        "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                  >
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Quote #
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Valid Until
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Amount
                    </TableHead>
                    <TableHead className="w-20 font-black text-sm uppercase tracking-wider text-white py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealQuotations.map((q) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      onClick={() => navigate(`/crm/quotes/${q.id}/edit`)}
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
                        {q.validUntil || "—"}
                      </TableCell>
                      <TableCell className="text-base font-bold text-slate-800 py-1">
                        ₹{(q.grandTotal ?? q.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell
                        className="text-base py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isCrmAdmin(user) && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                            title={`Delete quote ${q.quotationNumber}?`}
                            description="This quote and its line items will be moved to the CRM Recycle Bin."
                            onConfirm={() =>
                              deleteCrmQuotation(q.id, q.quotationNumber, user)
                            }
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
                  value={opportunity.contactId || ""}
                  onValueChange={(v) =>
                    updateCrmOpportunity(
                      opportunityId,
                      { contactId: v },
                      currentUser,
                    )
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
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
                  key={opportunityId}
                  defaultValue={opportunity.contactRole || ""}
                  onBlur={(e) =>
                    updateCrmOpportunity(
                      opportunityId,
                      { contactRole: e.target.value },
                      currentUser,
                    )
                  }
                  placeholder="e.g. Decision Maker"
                  className="h-9 rounded-xl"
                />
              </div>
            </div>
            {primaryContact && (
              <div className="rounded-2xl border border-slate-200/80 p-4 bg-slate-50/40 grid md:grid-cols-3 gap-3 text-sm">
                <Field icon={User} label="Name" value={primaryContact.name} />
                <Field
                  icon={User}
                  label="Email"
                  value={primaryContact.email || "—"}
                />
                <Field
                  icon={User}
                  label="Phone"
                  value={primaryContact.phone || "—"}
                />
              </div>
            )}
            {account && (
              <button
                onClick={() => navigate(`/crm/accounts/${account.id}`)}
                className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
              >
                <Building2 className="h-3.5 w-3.5" /> View full account —{" "}
                {account.name}
              </button>
            )}
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
            <div className="p-4 border-b border-slate-100 grid md:grid-cols-4 gap-2">
              <Select
                value={activityForm.type}
                onValueChange={(v) =>
                  setActivityForm((f) => ({ ...f, type: v as CrmActivityType }))
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
                disabled={!activityForm.subject.trim() || loggingActivity}
                onClick={handleLogActivity}
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
            {dealActivities.length === 0 ? (
              <EmptyState icon={ListChecks} title="No activities logged yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {dealActivities.map((a) => (
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
                        {new Date(a.occurredAt).toLocaleString()} ·{" "}
                        {a.createdBy}
                      </p>
                    </div>
                    {isCrmAdmin(user) && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                        title="Delete this activity?"
                        description={`"${a.subject}" will be moved to the CRM Recycle Bin.`}
                        onConfirm={() =>
                          deleteCrmActivity(a.id, a.subject, user)
                        }
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
                        ? `${stageLabel(h.fromStage)} → ${stageLabel(h.toStage)}`
                        : `Set to ${stageLabel(h.toStage)}`}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {new Date(h.changedAt).toLocaleString()} · {h.changedBy}
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
        products={products}
        opportunityId={opportunityId}
        opportunityTitle={opportunity.title}
        currentUser={currentUser}
      />
    </div>
  );
}
