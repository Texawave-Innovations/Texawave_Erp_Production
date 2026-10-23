"use client";

// Account / Client 360 view — port of legacy `AccountDetail.tsx`. The page shell (header card,
// tab row) lives here; each of the 12 tabs is its own component under ./tabs.
import { ApiError } from "@texawave-erp/core";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit,
  FileText,
  Flame,
  Globe,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ACCOUNT_PRIORITIES,
  ACCOUNT_TEMPERATURES,
} from "@texawave-erp/api-types";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/legacy-ui/tabs";
import { cn } from "@/components/legacy-ui/utils";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { ScrollableTabRow } from "@/features/crm/legacy-ui/ScrollableTabRow";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  useAccount,
  useChangeAccountPriority,
  useChangeAccountStatusTag,
  useChangeAccountTemperature,
  useDeleteAccount,
} from "../hooks";
import { useAccountRelated } from "../useAccountRelated";
import { AccountFormDialog } from "./AccountFormDialog";
import {
  accountContactHrefs,
  ContactChannel,
  CRM_DELETE_BTN_CLASS,
  LinkedinIcon,
  PriorityBadge,
  STATUS_TAG_STYLE,
  TemperatureBadge,
} from "./accountUi";
import { StatusTagDialog } from "./StatusTagDialog";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { ContactsTab } from "./tabs/ContactsTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { FollowUpsTab } from "./tabs/FollowUpsTab";
import { MeetingsTab } from "./tabs/MeetingsTab";
import { NotesTab } from "./tabs/NotesTab";
import { OpportunitiesTab } from "./tabs/OpportunitiesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { QuotationsTab } from "./tabs/QuotationsTab";
import { TasksTab } from "./tabs/TasksTab";
import { TimelineTab } from "./tabs/TimelineTab";

function Notice({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
      <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-4 rounded-xl gap-1.5"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
      </Button>
    </div>
  );
}

export function AccountDetail({ id }: { id: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUser = useAuthStore((s) => s.user?.fullName) ?? "CRM User";
  const canDeleteAccount = usePermission("crm.account.delete");

  // Back target: queues pass ?back=<path>&backLabel=<label>; default is the Accounts list.
  const backParam = searchParams.get("back");
  const backTo = backParam?.startsWith("/crm/") ? backParam : "/crm/accounts";
  const backLabel =
    (backParam?.startsWith("/crm/") && searchParams.get("backLabel")) ||
    "Accounts";

  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [statusOpen, setStatusOpen] = useState(false);

  const query = useAccount(id);
  const related = useAccountRelated(id);
  const changeStatusTag = useChangeAccountStatusTag();
  const changePriority = useChangeAccountPriority();
  const changeTemperature = useChangeAccountTemperature();
  const customFieldDefs = useCustomFields("accounts").data ?? [];
  const deleteAccount = useDeleteAccount();

  if (query.isPending) {
    return (
      <div className="text-center py-16 text-slate-900 text-sm">
        Loading Account…
      </div>
    );
  }
  if (query.isError) {
    const denied =
      query.error instanceof ApiError && query.error.isPermissionError;
    return (
      <Notice
        title={
          denied ? "You don't have access to this account" : "Account not found"
        }
        backLabel={backLabel}
        onBack={() => router.push(backTo)}
      />
    );
  }

  const account = query.data;
  const hrefs = accountContactHrefs(account);

  const closeEdit = () => {
    setIsEditing(false);
    if (searchParams.get("edit")) router.replace(pathname);
  };

  if (isEditing) {
    return (
      <div className="space-y-6 pb-8">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={closeEdit}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
        </Button>
        <AccountFormDialog
          open={isEditing}
          onOpenChange={(v) => !v && closeEdit()}
          mode="edit"
          account={account}
          currentUser={currentUser}
          renderAs="page"
          onCancel={closeEdit}
          onSaved={closeEdit}
        />
      </div>
    );
  }

  const totalRelated =
    related.contacts.length +
    related.opportunities.length +
    related.meetings.length +
    related.followUps.length +
    related.activities.length +
    related.quotations.length +
    related.documents.length +
    related.tasks.length +
    related.products.length;

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync(account.id);
    } catch {
      throw new Error("Failed to delete — please try again.");
    }
    toast.success(`Deleted "${account.name}"`);
    router.push("/crm/accounts");
  };

  const tabClass = "rounded-xl gap-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => router.push(backTo)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={() => setStatusOpen(true)}
          >
            <Tag className="h-3.5 w-3.5" /> Status
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>
          {canDeleteAccount && (
            <DeleteConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className={CRM_DELETE_BTN_CLASS}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Account
                </Button>
              }
              title={`Delete "${account.name}"?`}
              description="This account will be moved to the CRM Recycle Bin."
              warning={
                totalRelated > 0
                  ? `This account has ${related.contacts.length} contact(s), ${related.opportunities.length} opportunit${related.opportunities.length === 1 ? "y" : "ies"}, ${related.meetings.length} meeting(s), ${related.followUps.length} follow-up(s), ${related.activities.length} activit${related.activities.length === 1 ? "y" : "ies"}, ${related.quotations.length} quotation(s), ${related.documents.length} document(s), ${related.tasks.length} task(s), and ${related.products.length} product line item(s) — deleting it will move all of them to the Recycle Bin too.`
                  : undefined
              }
              confirmLabel={totalRelated > 0 ? "Delete Everything" : "Delete"}
              onConfirm={handleDeleteAccount}
            />
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-300/70 bg-white shadow-[0_8px_28px_-10px_rgba(51,65,85,0.28)] p-6 space-y-5">
        {/* Identity row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="p-3 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200 shrink-0">
              <Building2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {account.name}
                </h2>
                {account.accountType && (
                  <Badge variant="outline" className="text-xs">
                    {account.accountType}
                  </Badge>
                )}
                {account.statusTag && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border",
                      STATUS_TAG_STYLE[account.statusTag],
                    )}
                  >
                    {account.statusTag}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-900">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span>Account Owner:</span>
                <span className="font-semibold text-slate-700">
                  {account.ownerName || "Unassigned"}
                </span>
              </div>
              {account.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {account.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full"
                    >
                      <Tag className="h-2.5 w-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Priority
              </span>
              <div className="flex gap-1.5">
                {ACCOUNT_PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={changePriority.isPending}
                    onClick={() =>
                      changePriority.mutate(
                        { id: account.id, priority: p },
                        {
                          onError: () =>
                            toast.error("Failed to update priority."),
                        },
                      )
                    }
                    className={cn(
                      "transition-opacity",
                      account.priority === p
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-70",
                    )}
                  >
                    <PriorityBadge priority={p} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Temperature
              </span>
              <div className="flex gap-1.5">
                {ACCOUNT_TEMPERATURES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={changeTemperature.isPending}
                    onClick={() =>
                      changeTemperature.mutate(
                        { id: account.id, temperature: t },
                        {
                          onError: () =>
                            toast.error("Failed to update temperature."),
                        },
                      )
                    }
                    className={cn(
                      "transition-opacity",
                      account.temperature === t
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-70",
                    )}
                  >
                    <TemperatureBadge temperature={t} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Business snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ContactChannel
            icon={MapPin}
            label="Location"
            value={account.hq}
            tone="rose"
            empty="Not added"
          />
          <ContactChannel
            icon={Briefcase}
            label="Industry"
            value={account.industry}
            tone="indigo"
            empty="Not added"
          />
          <ContactChannel
            icon={Tag}
            label="Customer Type"
            value={account.customerCategory || account.accountType}
            tone="fuchsia"
            empty="Not added"
          />
        </div>

        {/* Contact channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ContactChannel
            icon={Phone}
            label="Phone"
            value={account.phone}
            href={hrefs.phone}
            tone="sky"
          />
          <ContactChannel
            icon={Mail}
            label="Email"
            value={account.email}
            href={hrefs.email}
            tone="purple"
          />
          <ContactChannel
            icon={MessageCircle}
            label="WhatsApp"
            value={account.phone}
            href={hrefs.whatsapp}
            tone="emerald"
          />
          <ContactChannel
            icon={LinkedinIcon}
            label="LinkedIn"
            value={account.linkedin ? "View Profile" : undefined}
            href={hrefs.linkedin}
            tone="blue"
            empty="Not available"
          />
          <ContactChannel
            icon={Globe}
            label="Website"
            value={account.website}
            href={hrefs.website}
            tone="amber"
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>

        {customFieldDefs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customFieldDefs.map((d) => (
              <ContactChannel
                key={d.key}
                icon={Sparkles}
                label={d.label}
                value={account.customFields?.[d.key]}
                tone="slate"
                empty="Not added"
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-slate-900 pt-1 border-t border-slate-100">
          <Clock3 className="h-3 w-3" />
          Last updated{" "}
          {new Date(account.updatedAt || account.createdAt).toLocaleString()}
          {account.updatedByName ? ` by ${account.updatedByName}` : ""}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabRow activeValue={activeTab}>
          <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max [&_[data-state=inactive]]:text-slate-700">
            <TabsTrigger value="overview" className={tabClass}>
              <Building2 className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className={tabClass}>
              <Users className="h-3.5 w-3.5" /> Contacts (
              {related.contacts.length})
            </TabsTrigger>
            <TabsTrigger value="opportunities" className={tabClass}>
              <Briefcase className="h-3.5 w-3.5" /> Opportunities (
              {related.opportunities.length})
            </TabsTrigger>
            <TabsTrigger value="meetings" className={tabClass}>
              <CalendarClock className="h-3.5 w-3.5" /> Meetings (
              {related.meetings.length})
            </TabsTrigger>
            <TabsTrigger value="followups" className={tabClass}>
              <Clock3 className="h-3.5 w-3.5" /> Follow-ups (
              {related.followUps.length})
            </TabsTrigger>
            <TabsTrigger value="activities" className={tabClass}>
              <ListChecks className="h-3.5 w-3.5" /> Activities (
              {related.activities.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className={tabClass}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Tasks (
              {related.tasks.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className={tabClass}>
              <StickyNote className="h-3.5 w-3.5" /> Notes (
              {related.notes.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className={tabClass}>
              <FileText className="h-3.5 w-3.5" /> Documents (
              {related.documents.length})
            </TabsTrigger>
            <TabsTrigger value="quotations" className={tabClass}>
              <Receipt className="h-3.5 w-3.5" /> Quotations (
              {related.quotations.length})
            </TabsTrigger>
            <TabsTrigger value="products" className={tabClass}>
              <Package className="h-3.5 w-3.5" /> Products (
              {related.products.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className={tabClass}>
              <Flame className="h-3.5 w-3.5" /> Timeline
            </TabsTrigger>
          </TabsList>
        </ScrollableTabRow>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <OverviewTab account={account} related={related} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab accountId={account.id} contacts={related.contacts} />
        </TabsContent>
        <TabsContent value="opportunities" className="mt-4">
          <OpportunitiesTab
            accountId={account.id}
            currentUser={currentUser}
            opportunities={related.opportunities}
          />
        </TabsContent>
        <TabsContent value="meetings" className="mt-4">
          <MeetingsTab accountId={account.id} meetings={related.meetings} />
        </TabsContent>
        <TabsContent value="followups" className="mt-4">
          <FollowUpsTab
            accountId={account.id}
            currentUser={currentUser}
            followUps={related.followUps}
          />
        </TabsContent>
        <TabsContent value="activities" className="mt-4">
          <ActivitiesTab
            accountId={account.id}
            activities={related.activities}
          />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab
            accountId={account.id}
            currentUser={currentUser}
            tasks={related.tasks}
          />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab
            accountId={account.id}
            accountName={account.name}
            notes={related.notes}
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab accountId={account.id} documents={related.documents} />
        </TabsContent>
        <TabsContent value="quotations" className="mt-4">
          <QuotationsTab quotations={related.quotations} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab products={related.products} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab account={account} related={related} />
        </TabsContent>
      </Tabs>

      <StatusTagDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatusTag={account.statusTag}
        onSubmit={async (values) => {
          await changeStatusTag.mutateAsync({ id: account.id, input: values });
          toast.success("Status tag updated");
        }}
      />
    </div>
  );
}
