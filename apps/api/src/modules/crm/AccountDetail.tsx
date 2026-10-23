// CRM Core Domain — Account / Client 360 View (section 11 of the CRM architecture). A single
// Account's Overview, Contacts, Opportunities, Meetings, Follow-ups, Activities, Notes,
// Documents, Quotations and unified Timeline, all in one page. This is a NEW page for the new
// relational Account entity — it is intentionally separate from the legacy `CompanyDetail.tsx`
// (`/crm/company/:companyKey`), which keeps showing the read-only view over the 8 sheet tabs
// unchanged.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm } from "./celebration";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit,
  Eye,
  FileText,
  Flame,
  Globe,
  History,
  IndianRupee,
  Linkedin,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Receipt,
  Send,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Swords,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTabRow } from "./components/ScrollableTabRow";
import { DatePicker } from "./components/DatePicker";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  DeleteConfirmDialog,
  EmptyState,
  StatTile,
  PriorityBadge,
  TemperatureBadge,
} from "./intelligence/components";
import {
  subscribeCrmMetadata,
  setCrmPriority,
  setCrmTemperature,
} from "./intelligence/metadataService";
import {
  addCrmNote,
  deleteCrmNote,
  subscribeCrmNotes,
} from "./intelligence/notesService";
import { subscribeCrmAuditLogs } from "./intelligence/auditService";
import {
  CrmAuditLogEntry,
  CrmMetadata,
  CrmNote,
  CrmPriority,
  CrmTemperature,
} from "./intelligence/types";
import { relativeDayLabel } from "./intelligence/shared";

import { useCrmDomainData } from "./domain/useCrmDomainData";
import { useCrmCustomFields } from "./bulkImport/crmCustomFieldsService";
import { createCrmContact, deleteCrmContact } from "./domain/contactsService";
import {
  createCrmOpportunity,
  subscribeAllCrmStageHistory,
} from "./domain/opportunitiesService";
import { deleteCrmActivity, logCrmActivity } from "./domain/activitiesService";
import {
  createCrmFollowUp,
  deleteCrmFollowUp,
  rescheduleCrmFollowUp,
  updateCrmFollowUpStatus,
} from "./domain/followupsService";
import {
  createCrmMeeting,
  deleteCrmMeeting,
  rescheduleCrmMeeting,
  updateCrmMeetingStatus,
} from "./domain/meetingsService";
import { deleteCrmQuotation } from "./domain/quotationsService";
import { removeCrmDealProduct } from "./domain/dealProductsService";
import { addCrmDocument, deleteCrmDocument } from "./domain/documentsService";
import {
  createCrmTask,
  deleteCrmTask,
  setCrmTaskStatus,
} from "./domain/tasksService";
import {
  deleteCrmAccount,
  deleteCrmAccountCascade,
} from "./domain/accountsService";
import { isCrmAdmin } from "./domain/roles";
import { AccountFormDialog } from "./domain/AccountFormDialog";
import { StatusTagDialog, STATUS_TAG_STYLE } from "./domain/StatusTagDialog";
import {
  ACTIVITY_TYPES,
  computeOpportunityHealth,
  getEffectiveFollowUpStatus,
} from "./domain/config";
import {
  liveStageLabel as stageLabel,
  useCrmPipelineStages,
} from "./domain/pipelineStagesService";
import { OpportunityDrawer } from "./domain/OpportunityDrawer";
import { MeetingCompleteDialog } from "./domain/MeetingCompleteDialog";
import {
  CrmAccount,
  CrmActivityType,
  CrmContactInput,
  CrmFollowUp,
  CrmMeeting,
  CrmOpportunity,
  CrmOpportunityInput,
  CrmStageHistoryEntry,
} from "./domain/types";
import { computeAccountRelatedIds } from "./domain/relatedLookup";

const PRIORITIES: CrmPriority[] = ["High", "Medium", "Low"];
const TEMPERATURES: CrmTemperature[] = ["Hot", "Warm", "Cold"];

const MEETING_STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-900 border-slate-200",
  TENTATIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200",
};

/** Shared styling for every Delete trigger button across Account Details — icon + "Delete" label,
 *  red danger color, same height/padding/radius/typography/hover state everywhere it appears. */
const CRM_DELETE_BTN_CLASS =
  "h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg";

const FOLLOWUP_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-900 border-slate-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  MISSED: "bg-red-50 text-red-700 border-red-200",
};

interface TimelineItem {
  id: string;
  date: number;
  title: string;
  description?: string;
  icon:
    | "account"
    | "contact"
    | "opportunity"
    | "stage"
    | "activity"
    | "meeting"
    | "followup"
    | "note"
    | "quotation"
    | "audit"
    | "product";
  /** Present only for timeline items backed by a real, existing CRM delete flow — routes through
   *  the same admin-only soft-delete/Recycle Bin path as the record's own tab. Omitted for
   *  items with no supported delete action (account creation, stage history, audit log entries,
   *  etc.) so the Timeline never shows a Delete button that can't actually delete anything. */
  deleteAction?: {
    confirmTitle: string;
    confirmDescription: string;
    onConfirm: () => Promise<void>;
  };
}

/** Audit actions already represented by a dedicated timeline source above (creation events,
 *  stage-history, notes, activities) — excluded here so the unified Timeline doesn't show the
 *  same event twice. Everything else (deletes, status changes, reschedules, edits) is new. */
const AUDIT_ACTIONS_ALREADY_SHOWN = new Set([
  "account_created",
  "contact_added",
  "opportunity_created",
  "opportunity_stage_changed",
  "followup_created",
  "meeting_scheduled",
  "quotation_created",
  "note_added",
  "activity_logged",
]);

/** `tel:`/`mailto:`/`wa.me`/normalized-URL href logic for an account's contact channels — shared
 *  by the header snapshot's ContactChannel row and the Overview tab's Company Information card's
 *  InfoField row, so a fix (e.g. normalizing phone numbers before the wa.me link) only needs to be
 *  applied once instead of independently in both places. */
function accountContactHrefs(
  account: Pick<CrmAccount, "phone" | "email" | "linkedin" | "website">,
) {
  const normalizeUrl = (v: string) =>
    v.startsWith("http") ? v : `https://${v}`;
  return {
    phone: account.phone ? `tel:${account.phone}` : undefined,
    email: account.email ? `mailto:${account.email}` : undefined,
    whatsapp: account.phone
      ? `https://wa.me/${account.phone.replace(/[^\d]/g, "")}`
      : undefined,
    linkedin: account.linkedin ? normalizeUrl(account.linkedin) : undefined,
    website: account.website ? normalizeUrl(account.website) : undefined,
  };
}

/** Subscribes to every opportunity's stage-history sub-node for this account and merges them.
 *  Uses the one shared, already-exported `subscribeAllCrmStageHistory` (built exactly for this
 *  "all opportunities, filter locally" case) instead of opening a separate `onValue` listener per
 *  opportunity — an account with 20 open opportunities previously opened 20 listeners instead of 1. */
function useAccountStageHistory(
  opportunityIds: string[],
): CrmStageHistoryEntry[] {
  const [allEntries, setAllEntries] = useState<CrmStageHistoryEntry[]>([]);

  useEffect(() => subscribeAllCrmStageHistory(setAllEntries), []);

  return useMemo(() => {
    const ids = new Set(opportunityIds);
    return allEntries.filter((e) => ids.has(e.opportunityId));
  }, [allEntries, opportunityIds.join(",")]);
}

export default function AccountDetail() {
  const { accountId = "" } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";

  const backState = location.state as {
    from?: string;
    label?: string;
    openEdit?: boolean;
  } | null;
  const backTo = backState?.from || "/crm/accounts";
  const backLabel = backState?.label || "Accounts";
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(!!backState?.openEdit);

  const {
    accounts,
    contacts,
    opportunities,
    activities,
    followUps,
    meetings,
    quotations,
    documents,
    tasks,
    dealProducts,
    loading,
  } = useCrmDomainData();
  const account = accounts.find((a) => a.id === accountId);
  const customFieldDefs = useCrmCustomFields("accounts");

  const accountContacts = useMemo(
    () => contacts.filter((c) => c.accountId === accountId),
    [contacts, accountId],
  );
  const accountOpportunities = useMemo(
    () => opportunities.filter((o) => o.accountId === accountId),
    [opportunities, accountId],
  );
  const opportunityIds = useMemo(
    () => accountOpportunities.map((o) => o.id),
    [accountOpportunities],
  );
  const relevantIds = useMemo(
    () =>
      new Set([
        accountId,
        ...opportunityIds,
        ...accountContacts.map((c) => c.id),
      ]),
    [accountId, opportunityIds, accountContacts],
  );

  const accountActivities = useMemo(
    () => activities.filter((a) => relevantIds.has(a.relatedId)),
    [activities, relevantIds],
  );
  const accountFollowUps = useMemo(
    () => followUps.filter((f) => relevantIds.has(f.relatedId)),
    [followUps, relevantIds],
  );
  const accountMeetings = useMemo(
    () => meetings.filter((m) => relevantIds.has(m.relatedId)),
    [meetings, relevantIds],
  );
  const accountQuotations = useMemo(
    () => quotations.filter((q) => q.accountId === accountId),
    [quotations, accountId],
  );
  const accountDocuments = useMemo(
    () => documents.filter((d) => relevantIds.has(d.relatedId)),
    [documents, relevantIds],
  );
  const accountTasks = useMemo(
    () => tasks.filter((t) => relevantIds.has(t.relatedId)),
    [tasks, relevantIds],
  );
  const stageHistory = useAccountStageHistory(opportunityIds);

  const accountDealProducts = useMemo(
    () =>
      dealProducts.filter((dp) => opportunityIds.includes(dp.opportunityId)),
    [dealProducts, opportunityIds],
  );
  const productsSubtotal = useMemo(
    () => accountDealProducts.reduce((sum, dp) => sum + dp.total, 0),
    [accountDealProducts],
  );

  const accountCompetitors = useMemo(
    () =>
      accountOpportunities
        .filter((o) => o.competitor && o.competitor.trim())
        .map((o) => ({ opportunity: o, competitor: o.competitor as string })),
    [accountOpportunities],
  );

  const kpis = useMemo(() => {
    const openDeals = accountOpportunities.filter((o) => o.status === "OPEN");
    const wonDeals = accountOpportunities.filter((o) => o.status === "WON");
    const lostDeals = accountOpportunities.filter((o) => o.status === "LOST");
    const pipelineValue = openDeals.reduce(
      (sum, o) => sum + (o.estimatedValue || 0),
      0,
    );
    const totalRevenue = wonDeals.reduce(
      (sum, o) => sum + (o.closingAmount ?? o.estimatedValue ?? 0),
      0,
    );
    const openActivities =
      accountFollowUps.filter(
        (f) =>
          getEffectiveFollowUpStatus(f) === "PENDING" ||
          getEffectiveFollowUpStatus(f) === "OVERDUE",
      ).length + accountTasks.filter((t) => t.status !== "Completed").length;
    const completedActivities =
      accountActivities.length +
      accountTasks.filter((t) => t.status === "Completed").length;
    return {
      contacts: accountContacts.length,
      openDeals: openDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      pipelineValue,
      totalRevenue,
      quotes: accountQuotations.length,
      openActivities,
      completedActivities,
    };
  }, [
    accountOpportunities,
    accountFollowUps,
    accountTasks,
    accountActivities,
    accountContacts,
    accountQuotations,
  ]);

  const [metadata, setMetadata] = useState<CrmMetadata | undefined>();
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<CrmAuditLogEntry[]>([]);
  useEffect(
    () => subscribeCrmMetadata((all) => setMetadata(all[accountId])),
    [accountId],
  );
  useEffect(() => subscribeCrmNotes(accountId, setNotes), [accountId]);
  useEffect(() => subscribeCrmAuditLogs(setAuditLogs), []);
  const { stages: pipelineStages } = useCrmPipelineStages();

  const accountReview = useMemo(() => {
    const lastTouchpoints = [
      ...accountActivities.map((a) => a.occurredAt),
      ...accountMeetings
        .filter((m) => m.status === "COMPLETED")
        .map((m) => m.updatedAt || m.createdAt),
      ...accountFollowUps
        .filter((f) => f.status === "COMPLETED")
        .map((f) => f.updatedAt || f.createdAt),
      ...notes.map((n) => n.createdAt),
    ];
    const lastInteractionAt = lastTouchpoints.length
      ? Math.max(...lastTouchpoints)
      : undefined;

    const upcomingFollowUps = accountFollowUps
      .filter(
        (f) => getEffectiveFollowUpStatus(f) === "PENDING" && f.scheduledAt,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    const nextFollowUp = upcomingFollowUps[0];

    const openOpportunities = accountOpportunities.filter(
      (o) => o.status === "OPEN",
    );
    const overdueFollowUps = accountFollowUps.filter(
      (f) => getEffectiveFollowUpStatus(f) === "OVERDUE",
    ).length;
    const daysSinceLastInteraction = lastInteractionAt
      ? (Date.now() - lastInteractionAt) / 86400000
      : undefined;

    let status: "Active" | "New" | "Dormant" = "New";
    if (accountOpportunities.length > 0 || accountActivities.length > 0)
      status = "Active";
    if (
      daysSinceLastInteraction !== undefined &&
      daysSinceLastInteraction > 30 &&
      openOpportunities.length === 0
    )
      status = "Dormant";

    const needsAttention =
      overdueFollowUps > 0 ||
      (daysSinceLastInteraction !== undefined && daysSinceLastInteraction > 30);

    return {
      lastInteractionAt,
      nextFollowUp,
      openOpportunitiesCount: openOpportunities.length,
      overdueFollowUps,
      status,
      needsAttention,
      daysSinceLastInteraction,
    };
  }, [
    accountActivities,
    accountMeetings,
    accountFollowUps,
    notes,
    accountOpportunities,
  ]);

  const accountAuditLogs = useMemo(
    () =>
      auditLogs.filter(
        (l) =>
          (l.entityId && relevantIds.has(l.entityId)) ||
          l.companyKey === accountId,
      ),
    [auditLogs, relevantIds, accountId],
  );

  const [activeOpportunity, setActiveOpportunity] =
    useState<CrmOpportunity | null>(null);
  const [completingMeeting, setCompletingMeeting] = useState<CrmMeeting | null>(
    null,
  );
  const [reschedulingMeeting, setReschedulingMeeting] =
    useState<CrmMeeting | null>(null);
  const [reschedulingFollowUp, setReschedulingFollowUp] =
    useState<CrmFollowUp | null>(null);
  const [completingFollowUp, setCompletingFollowUp] =
    useState<CrmFollowUp | null>(null);

  // --- dialogs -------------------------------------------------------------------------------
  const [contactDialog, setContactDialog] = useState(false);
  const [oppDialog, setOppDialog] = useState(false);
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const [activityDialog, setActivityDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    if (account)
      items.push({
        id: `account_${account.id}`,
        date: account.createdAt,
        title: "Account Created",
        description: account.name,
        icon: "account",
      });
    accountContacts.forEach((c) =>
      items.push({
        id: `contact_${c.id}`,
        date: c.createdAt,
        title: `Contact Added — ${c.name}`,
        description: c.designation,
        icon: "contact",
        deleteAction: {
          confirmTitle: "Delete this contact?",
          confirmDescription: `"${c.name}" will be moved to the CRM Recycle Bin.`,
          onConfirm: () => deleteCrmContact(c.id, c.name, user),
        },
      }),
    );
    accountOpportunities.forEach((o) =>
      items.push({
        id: `opp_${o.id}`,
        date: o.createdAt,
        title: `Opportunity Created — ${o.title}`,
        description: `${stageLabel(o.stage)} · ₹${o.estimatedValue.toLocaleString("en-IN")}`,
        icon: "opportunity",
      }),
    );
    stageHistory.forEach((h) =>
      items.push({
        id: `stage_${h.id}`,
        date: h.changedAt,
        title: h.fromStage
          ? `Stage: ${stageLabel(h.fromStage)} → ${stageLabel(h.toStage)}`
          : `Stage set to ${stageLabel(h.toStage)}`,
        description: h.remarks ? `${h.remarks} · ${h.changedBy}` : h.changedBy,
        icon: "stage",
      }),
    );
    accountActivities.forEach((a) =>
      items.push({
        id: `activity_${a.id}`,
        date: a.occurredAt,
        title: `${a.type} — ${a.subject}`,
        description: a.notes,
        icon: "activity",
        deleteAction: {
          confirmTitle: "Delete this activity?",
          confirmDescription:
            "This logged activity will be moved to the CRM Recycle Bin.",
          onConfirm: () => deleteCrmActivity(a.id, a.subject, user),
        },
      }),
    );
    accountMeetings.forEach((m) =>
      items.push({
        id: `meeting_${m.id}`,
        date: m.createdAt,
        title: `Meeting (${m.mode}) — ${m.status}`,
        description: m.agenda,
        icon: "meeting",
        deleteAction: {
          confirmTitle: "Delete this meeting?",
          confirmDescription:
            "This meeting and its recorded outcome will be moved to the CRM Recycle Bin.",
          onConfirm: () => deleteCrmMeeting(m.id, user),
        },
      }),
    );
    accountFollowUps.forEach((f) =>
      items.push({
        id: `followup_${f.id}`,
        date: f.createdAt,
        title: `Follow-up (${f.type}) — ${f.status}`,
        description: f.notes,
        icon: "followup",
        deleteAction: {
          confirmTitle: "Delete this follow-up?",
          confirmDescription:
            "This follow-up and its reschedule history will be moved to the CRM Recycle Bin.",
          onConfirm: () => deleteCrmFollowUp(f.id, user),
        },
      }),
    );
    accountQuotations.forEach((q) =>
      items.push({
        id: `quote_${q.id}`,
        date: q.createdAt,
        title: `Quotation ${q.quotationNumber} — ${q.status}`,
        description: `₹${q.amount.toLocaleString("en-IN")}`,
        icon: "quotation",
        deleteAction: {
          confirmTitle: "Delete this quotation?",
          confirmDescription: `Quotation ${q.quotationNumber} will be moved to the CRM Recycle Bin.`,
          onConfirm: () => deleteCrmQuotation(q.id, q.quotationNumber, user),
        },
      }),
    );
    notes.forEach((n) =>
      items.push({
        id: `note_${n.id}`,
        date: n.createdAt,
        title: `Note by ${n.createdBy}`,
        description: n.content,
        icon: "note",
        deleteAction: {
          confirmTitle: "Delete this note?",
          confirmDescription: "This note will be moved to the CRM Recycle Bin.",
          onConfirm: () => deleteCrmNote(accountId, n.id, user),
        },
      }),
    );
    accountDealProducts.forEach((dp) => {
      const dealTitle = accountOpportunities.find(
        (o) => o.id === dp.opportunityId,
      )?.title;
      items.push({
        id: `product_${dp.id}`,
        date: dp.createdAt,
        title: `Product Added — ${dp.productName}`,
        description: dealTitle
          ? `Qty ${dp.quantity} · ${dealTitle}`
          : `Qty ${dp.quantity}`,
        icon: "product",
      });
    });
    accountAuditLogs
      .filter((l) => !AUDIT_ACTIONS_ALREADY_SHOWN.has(l.action))
      .forEach((l) =>
        items.push({
          id: `audit_${l.id}`,
          date: l.at,
          title: `${l.action.replace(/_/g, " ")} — ${l.by}`,
          description: l.details,
          icon: "audit",
        }),
      );
    return items.sort((a, b) => b.date - a.date);
  }, [
    account,
    accountContacts,
    accountOpportunities,
    stageHistory,
    accountActivities,
    accountMeetings,
    accountFollowUps,
    accountQuotations,
    notes,
    accountDealProducts,
    accountAuditLogs,
    accountId,
    user,
  ]);

  const groupedTimeline = useMemo(() => {
    const groups: { label: string; items: TimelineItem[] }[] = [];
    timeline.forEach((item) => {
      const label = relativeDayLabel(new Date(item.date));
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    });
    return groups;
  }, [timeline]);

  if (loading)
    return (
      <div className="text-center py-16 text-slate-900 text-sm">
        Loading Account…
      </div>
    );

  if (!account) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
        <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-bold text-slate-900">Account not found</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 rounded-xl gap-1.5"
          onClick={() => navigate(backTo)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
        </Button>
      </div>
    );
  }

  const accountHrefs = accountContactHrefs(account);

  const handleAddNote = async () => {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await addCrmNote(accountId, account.name, noteDraft, currentUser);
      setNoteDraft("");
    } catch (err) {
      console.error("Failed to add note:", err);
      toast.error("Failed to add note. Please try again.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteAccount = async () => {
    const related = computeAccountRelatedIds(accountId, {
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
    const totalRelated = Object.values(related).reduce(
      (sum, ids) => sum + ids.length,
      0,
    );
    if (totalRelated > 0) {
      await deleteCrmAccountCascade(
        { id: accountId, name: account.name },
        related,
        user,
      );
    } else {
      await deleteCrmAccount(accountId, account.name, user);
    }
    navigate("/crm/accounts");
  };

  const totalAccountRelated =
    accountContacts.length +
    accountOpportunities.length +
    accountMeetings.length +
    accountFollowUps.length +
    accountActivities.length +
    accountQuotations.length +
    accountDocuments.length +
    accountTasks.length +
    accountDealProducts.length;

  if (isEditing) {
    return (
      <div className="space-y-6 pb-8">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => setIsEditing(false)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
        </Button>
        <AccountFormDialog
          open={isEditing}
          onOpenChange={(v) => !v && setIsEditing(false)}
          mode="edit"
          account={account}
          currentUser={currentUser}
          renderAs="page"
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => navigate(backTo)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {backLabel}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <StatusTagDialog
            account={account}
            currentUser={currentUser}
            openTasks={accountTasks.filter((t) => t.status === "Open")}
          />
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>
          {isCrmAdmin(user) && (
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
                totalAccountRelated > 0
                  ? `This account has ${accountContacts.length} contact(s), ${accountOpportunities.length} opportunit${accountOpportunities.length === 1 ? "y" : "ies"}, ${accountMeetings.length} meeting(s), ${accountFollowUps.length} follow-up(s), ${accountActivities.length} activit${accountActivities.length === 1 ? "y" : "ies"}, ${accountQuotations.length} quotation(s), ${accountDocuments.length} document(s), ${accountTasks.length} task(s), and ${accountDealProducts.length} product line item(s) — deleting it will move all of them to the Recycle Bin too.`
                  : undefined
              }
              confirmLabel={
                totalAccountRelated > 0 ? "Delete Everything" : "Delete"
              }
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
              {account.tags && account.tags.length > 0 && (
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
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setCrmPriority(accountId, account.name, p, currentUser)
                    }
                    className={cn(
                      "transition-opacity",
                      metadata?.priority === p
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
                {TEMPERATURES.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setCrmTemperature(accountId, account.name, t, currentUser)
                    }
                    className={cn(
                      "transition-opacity",
                      metadata?.temperature === t
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
            href={accountHrefs.phone}
            tone="sky"
          />
          <ContactChannel
            icon={Mail}
            label="Email"
            value={account.email}
            href={accountHrefs.email}
            tone="purple"
          />
          <ContactChannel
            icon={MessageCircle}
            label="WhatsApp"
            value={account.phone}
            href={accountHrefs.whatsapp}
            tone="emerald"
          />
          <ContactChannel
            icon={Linkedin}
            label="LinkedIn"
            value={account.linkedin ? "View Profile" : undefined}
            href={accountHrefs.linkedin}
            tone="blue"
            empty="Not available"
          />
          <ContactChannel
            icon={Globe}
            label="Website"
            value={account.website}
            href={accountHrefs.website}
            tone="amber"
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>

        {/* Custom fields — discovered by CRM Bulk Import from an Excel column with no matching
            built-in Account field (see bulkImport/crmCustomFieldsService.ts). Reuses the same
            ContactChannel tile every built-in field above already renders with. */}
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
          {account.updatedBy ? ` by ${account.updatedBy}` : ""}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabRow activeValue={activeTab}>
          <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max [&_[data-state=inactive]]:text-slate-700">
            <TabsTrigger value="overview" className="rounded-xl gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className="rounded-xl gap-1.5">
              <Users className="h-3.5 w-3.5" /> Contacts (
              {accountContacts.length})
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="rounded-xl gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Opportunities (
              {accountOpportunities.length})
            </TabsTrigger>
            <TabsTrigger value="meetings" className="rounded-xl gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Meetings (
              {accountMeetings.length})
            </TabsTrigger>
            <TabsTrigger value="followups" className="rounded-xl gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> Follow-ups (
              {accountFollowUps.length})
            </TabsTrigger>
            <TabsTrigger value="activities" className="rounded-xl gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Activities (
              {accountActivities.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tasks (
              {accountTasks.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-xl gap-1.5">
              <StickyNote className="h-3.5 w-3.5" /> Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Documents (
              {accountDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-xl gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Quotations (
              {accountQuotations.length})
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-xl gap-1.5">
              <Package className="h-3.5 w-3.5" /> Products (
              {accountDealProducts.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-xl gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Timeline
            </TabsTrigger>
          </TabsList>
        </ScrollableTabRow>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatTile
              icon={Users}
              label="Contacts"
              value={kpis.contacts}
              tone="blue"
            />
            <StatTile
              icon={Briefcase}
              label="Open Deals"
              value={kpis.openDeals}
              tone="brand"
            />
            <StatTile
              icon={CheckCircle2}
              label="Won Deals"
              value={kpis.wonDeals}
              tone="emerald"
            />
            <StatTile
              icon={XCircle}
              label="Lost Deals"
              value={kpis.lostDeals}
              tone="red"
            />
            <StatTile
              icon={Receipt}
              label="Quotes"
              value={kpis.quotes}
              tone="purple"
            />
            <StatTile
              icon={IndianRupee}
              label="Pipeline Value"
              value={`₹${kpis.pipelineValue.toLocaleString("en-IN")}`}
              tone="amber"
            />
            <StatTile
              icon={TrendingUp}
              label="Total Revenue (Won)"
              value={`₹${kpis.totalRevenue.toLocaleString("en-IN")}`}
              tone="gold"
            />
            <StatTile
              icon={Package}
              label="Products on Deals"
              value={accountDealProducts.length}
              tone="teal"
            />
            <StatTile
              icon={Clock3}
              label="Open Activities"
              value={kpis.openActivities}
              tone="orange"
            />
            <StatTile
              icon={History}
              label="Completed Activities"
              value={kpis.completedActivities}
              tone="slate"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand-600" /> Company
                  Information
                </h3>
              </div>
              <div className="p-5 grid sm:grid-cols-2 gap-x-3 gap-y-3">
                <InfoField
                  icon={Building2}
                  label="Account Name"
                  value={account.name}
                  tone="brand"
                />
                <InfoField
                  icon={Users}
                  label="Account Owner"
                  value={account.ownerName}
                />
                <InfoField
                  icon={MapPin}
                  label="Location"
                  value={account.hq}
                  tone="rose"
                  showEmpty
                />
                <InfoField
                  icon={Briefcase}
                  label="Industry"
                  value={account.industry}
                  tone="indigo"
                  showEmpty
                />
                <InfoField
                  icon={Tag}
                  label="Customer Type"
                  value={account.customerCategory || account.accountType}
                  tone="fuchsia"
                  showEmpty
                />
                <InfoField
                  icon={Globe}
                  label="Website"
                  value={account.website}
                  href={accountHrefs.website}
                  tone="amber"
                  showEmpty
                />
                <InfoField
                  icon={Phone}
                  label="Phone"
                  value={account.phone}
                  href={accountHrefs.phone}
                  tone="sky"
                  showEmpty
                />
                <InfoField
                  icon={Mail}
                  label="Email"
                  value={account.email}
                  href={accountHrefs.email}
                  tone="purple"
                  showEmpty
                />
                <InfoField
                  icon={MessageCircle}
                  label="WhatsApp"
                  value={account.phone}
                  href={accountHrefs.whatsapp}
                  tone="emerald"
                  showEmpty
                />
                <InfoField
                  icon={Linkedin}
                  label="LinkedIn"
                  value={account.linkedin ? "View Profile" : undefined}
                  href={accountHrefs.linkedin}
                  tone="blue"
                  showEmpty
                />
                <InfoField
                  icon={Users}
                  label="Company Size"
                  value={
                    account.numberOfEmployees
                      ? `${account.numberOfEmployees} employees`
                      : undefined
                  }
                />
                <InfoField
                  icon={IndianRupee}
                  label="Annual Revenue"
                  value={
                    account.annualRevenue
                      ? `₹${account.annualRevenue.toLocaleString("en-IN")}`
                      : undefined
                  }
                  tone="amber"
                />
                <InfoField
                  icon={FileText}
                  label="Registration / Reference"
                  value={account.registrationNumber}
                />
                <InfoField
                  icon={MapPin}
                  label="Billing Address"
                  value={
                    [
                      account.billingStreet,
                      account.billingCity,
                      account.billingState,
                      account.billingPostalCode,
                      account.billingCountry,
                    ]
                      .filter(Boolean)
                      .join(", ") || undefined
                  }
                  tone="rose"
                />
                <InfoField
                  icon={MapPin}
                  label="Shipping Address"
                  value={
                    [
                      account.shippingStreet,
                      account.shippingCity,
                      account.shippingState,
                      account.shippingPostalCode,
                      account.shippingCountry,
                    ]
                      .filter(Boolean)
                      .join(", ") || undefined
                  }
                  tone="rose"
                />
                {account.description && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-900 mb-1">
                      Description
                    </p>
                    <p className="text-sm text-slate-700">
                      {account.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-brand-600" /> Account
                  Review
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-900">
                    Customer Status
                  </span>
                  <Badge
                    className={cn(
                      "text-xs border",
                      accountReview.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : accountReview.status === "Dormant"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-100 text-slate-900 border-slate-200",
                    )}
                  >
                    {accountReview.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-900">
                    Open Opportunities
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {accountReview.openOpportunitiesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-900">
                    Last Interaction
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {accountReview.lastInteractionAt
                      ? new Date(
                          accountReview.lastInteractionAt,
                        ).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-900">Next Follow-up</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {accountReview.nextFollowUp
                      ? accountReview.nextFollowUp.scheduledAt
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-900">
                    Overdue Follow-ups
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      accountReview.overdueFollowUps > 0
                        ? "text-red-600"
                        : "text-slate-800",
                    )}
                  >
                    {accountReview.overdueFollowUps}
                  </span>
                </div>
                {accountReview.needsAttention && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      {accountReview.overdueFollowUps > 0
                        ? `${accountReview.overdueFollowUps} overdue follow-up${accountReview.overdueFollowUps === 1 ? "" : "s"} need attention.`
                        : `No interaction in ${Math.floor(accountReview.daysSinceLastInteraction || 0)} days — consider reaching out.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {accountCompetitors.length > 0 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Swords className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Competitive Landscape
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {accountCompetitors.map(({ opportunity, competitor }) => (
                  <div
                    key={opportunity.id}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {competitor}
                      </p>
                      <p className="text-sm text-slate-900 mt-0.5">
                        Deal: {opportunity.title}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {opportunity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-4">
          {contactDialog ? (
            <ContactInlineForm
              accountId={accountId}
              currentUser={currentUser}
              onCancel={() => setContactDialog(false)}
              onSaved={() => setContactDialog(false)}
            />
          ) : (
            <SectionShell
              title="Contacts"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setContactDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Contact
                </Button>
              }
            >
              {accountContacts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No contacts yet"
                  description="Add the people you deal with at this account."
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
                        Name
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Designation
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Email
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Phone
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Flags
                      </TableHead>
                      <TableHead className="w-20 font-black text-sm uppercase tracking-wider text-white py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountContacts.map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      >
                        <TableCell className="font-semibold text-slate-700 text-base py-1">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-base text-slate-900 py-1">
                          {c.designation || "—"}
                          {c.department ? ` · ${c.department}` : ""}
                        </TableCell>
                        <TableCell className="text-base text-slate-900 py-1">
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="text-brand-600 hover:underline"
                            >
                              {c.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-base text-slate-900 py-1">
                          {c.phone || c.whatsapp ? (
                            <a
                              href={`tel:${c.phone || c.whatsapp}`}
                              className="text-brand-600 hover:underline"
                            >
                              {c.phone || c.whatsapp}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="space-x-1 text-base py-1">
                          {c.isPrimary && (
                            <Badge variant="outline" className="text-xs">
                              Primary
                            </Badge>
                          )}
                          {c.isDecisionMaker && (
                            <Badge variant="outline" className="text-xs">
                              Decision Maker
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-base py-1">
                          {isCrmAdmin(user) && (
                            <DeleteConfirmDialog
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={CRM_DELETE_BTN_CLASS}
                                  title="Delete contact"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title="Delete this contact?"
                              description={`"${c.name}" will be moved to the CRM Recycle Bin.`}
                              onConfirm={() =>
                                deleteCrmContact(c.id, c.name, user)
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="mt-4">
          {oppDialog ? (
            <OpportunityInlineForm
              accountId={accountId}
              currentUser={currentUser}
              onCancel={() => setOppDialog(false)}
              onSaved={() => setOppDialog(false)}
            />
          ) : activeTab === "opportunities" && activeOpportunity ? (
            <div className="space-y-4">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl gap-1.5 -ml-2"
                onClick={() => setActiveOpportunity(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
              </Button>
              <OpportunityDrawer
                opportunity={activeOpportunity}
                accountName={account.name}
                open
                onOpenChange={(o) => !o && setActiveOpportunity(null)}
                currentUser={currentUser}
                renderAs="page"
              />
            </div>
          ) : (
            <SectionShell
              title="Opportunities"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setOppDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> New Opportunity
                </Button>
              }
            >
              {accountOpportunities.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No opportunities yet"
                  description="Create one to start tracking a deal through the pipeline."
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
                        Title
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Stage
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Value
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Close Date
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountOpportunities.map((o) => {
                      const slaDays = pipelineStages.find(
                        (s) => s.id === o.stage,
                      )?.slaDays;
                      const health = computeOpportunityHealth(
                        o.stageEnteredAt,
                        o.status,
                        slaDays,
                      );
                      return (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                          onClick={() => setActiveOpportunity(o)}
                        >
                          <TableCell className="font-semibold text-slate-700 text-base py-1">
                            {o.title}
                            {o.opportunityNumber && (
                              <span className="block text-sm text-slate-900 font-normal">
                                {o.opportunityNumber}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            {stageLabel(o.stage)}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            ₹{o.estimatedValue.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            {o.expectedCloseDate || "—"}
                          </TableCell>
                          <TableCell className="text-base py-1">
                            <Badge variant="outline" className="text-xs">
                              {o.status}
                            </Badge>
                            {o.status === "OPEN" && health !== "Healthy" && (
                              <Badge variant="warning" className="text-xs ml-1">
                                {health}
                              </Badge>
                            )}
                            {o.competitor && (
                              <span className="block text-sm text-slate-900 mt-1">
                                vs. {o.competitor}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Meetings */}
        <TabsContent value="meetings" className="mt-4">
          {meetingDialog ? (
            <MeetingInlineForm
              relatedId={accountId}
              currentUser={currentUser}
              onCancel={() => setMeetingDialog(false)}
              onSaved={() => setMeetingDialog(false)}
            />
          ) : completingMeeting ? (
            <MeetingCompleteDialog
              meeting={completingMeeting}
              open
              onOpenChange={(o) => !o && setCompletingMeeting(null)}
              currentUser={currentUser}
              renderAs="page"
            />
          ) : reschedulingMeeting ? (
            <RescheduleInlineForm
              currentDate={reschedulingMeeting.date}
              label="meeting"
              onCancel={() => setReschedulingMeeting(null)}
              onConfirm={(newDate, reason) =>
                rescheduleCrmMeeting(
                  reschedulingMeeting.id,
                  reschedulingMeeting.date,
                  newDate,
                  reason,
                  currentUser,
                )
              }
              onSaved={() => setReschedulingMeeting(null)}
            />
          ) : (
            <SectionShell
              title="Meetings"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setMeetingDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Schedule Meeting
                </Button>
              }
            >
              {accountMeetings.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No meetings yet" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accountMeetings.map((m) => {
                    const isDone =
                      m.status === "COMPLETED" || m.status === "CANCELLED";
                    return (
                      <div key={m.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {m.mode} meeting — {m.date}
                              {m.startTime ? ` at ${m.startTime}` : ""}
                            </p>
                            {m.agenda && (
                              <p className="text-sm text-slate-900 mt-1">
                                {m.agenda}
                              </p>
                            )}
                            {m.location && (
                              <p className="text-sm text-slate-900 mt-0.5">
                                {m.location}
                              </p>
                            )}
                            {m.status === "COMPLETED" && m.summary && (
                              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-1.5">
                                {m.summary}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "border shrink-0",
                              MEETING_STATUS_STYLE[m.status],
                            )}
                          >
                            {m.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isDone && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setCompletingMeeting(m)}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                                onClick={() => setReschedulingMeeting(m)}
                              >
                                <History className="h-3 w-3" /> Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  updateCrmMeetingStatus(
                                    m.id,
                                    "CANCELLED",
                                    currentUser,
                                  )
                                }
                              >
                                <XCircle className="h-3 w-3" /> Cancel
                              </Button>
                            </>
                          )}
                          {isCrmAdmin(user) && (
                            <DeleteConfirmDialog
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={CRM_DELETE_BTN_CLASS}
                                  title="Delete meeting"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title="Delete this meeting?"
                              description="This meeting and its recorded outcome will be moved to the CRM Recycle Bin."
                              onConfirm={() => deleteCrmMeeting(m.id, user)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Follow-ups */}
        <TabsContent value="followups" className="mt-4">
          {followUpDialog ? (
            <FollowUpInlineForm
              relatedId={accountId}
              currentUser={currentUser}
              onCancel={() => setFollowUpDialog(false)}
              onSaved={() => setFollowUpDialog(false)}
            />
          ) : completingFollowUp ? (
            <FollowUpCompleteInlineForm
              followUp={completingFollowUp}
              currentUser={currentUser}
              onCancel={() => setCompletingFollowUp(null)}
              onSaved={() => setCompletingFollowUp(null)}
            />
          ) : reschedulingFollowUp ? (
            <RescheduleInlineForm
              currentDate={reschedulingFollowUp.scheduledAt}
              label="follow-up"
              onCancel={() => setReschedulingFollowUp(null)}
              onConfirm={(newDate, reason) =>
                rescheduleCrmFollowUp(
                  reschedulingFollowUp.id,
                  reschedulingFollowUp.scheduledAt,
                  newDate,
                  reason,
                  currentUser,
                )
              }
              onSaved={() => setReschedulingFollowUp(null)}
            />
          ) : (
            <SectionShell
              title="Follow-ups"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setFollowUpDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Follow-up
                </Button>
              }
            >
              {accountFollowUps.length === 0 ? (
                <EmptyState icon={Clock3} title="No follow-ups yet" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accountFollowUps.map((f) => {
                    const effectiveStatus = getEffectiveFollowUpStatus(f);
                    const isDone =
                      f.status === "COMPLETED" || f.status === "CANCELLED";
                    const historyCount = f.rescheduleHistory
                      ? Object.keys(f.rescheduleHistory).length
                      : 0;
                    return (
                      <div key={f.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {f.type} — {f.scheduledAt}
                            </p>
                            <p className="text-sm text-slate-900 mt-1">
                              Assigned to {f.assignedTo} · {f.priority} priority
                              {historyCount > 0
                                ? ` · rescheduled ${historyCount}×`
                                : ""}
                            </p>
                            {f.notes && (
                              <p className="text-sm text-slate-900 mt-0.5">
                                {f.notes}
                              </p>
                            )}
                            {f.status === "COMPLETED" && f.outcome && (
                              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-1.5">
                                {f.outcome}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "border shrink-0",
                              FOLLOWUP_STATUS_STYLE[effectiveStatus],
                            )}
                          >
                            {effectiveStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isDone && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setCompletingFollowUp(f)}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1"
                                onClick={() => setReschedulingFollowUp(f)}
                              >
                                <History className="h-3 w-3" /> Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  updateCrmFollowUpStatus(
                                    f.id,
                                    "CANCELLED",
                                    currentUser,
                                  )
                                }
                              >
                                <XCircle className="h-3 w-3" /> Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs rounded-lg text-slate-900"
                                onClick={() =>
                                  updateCrmFollowUpStatus(
                                    f.id,
                                    "MISSED",
                                    currentUser,
                                  )
                                }
                              >
                                Mark Missed
                              </Button>
                            </>
                          )}
                          {isCrmAdmin(user) && (
                            <DeleteConfirmDialog
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={CRM_DELETE_BTN_CLASS}
                                  title="Delete follow-up"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title="Delete this follow-up?"
                              description="This follow-up and its reschedule history will be moved to the CRM Recycle Bin."
                              onConfirm={() => deleteCrmFollowUp(f.id, user)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="mt-4">
          {activityDialog ? (
            <ActivityInlineForm
              relatedId={accountId}
              currentUser={currentUser}
              onCancel={() => setActivityDialog(false)}
              onSaved={() => setActivityDialog(false)}
            />
          ) : (
            <SectionShell
              title="Activities"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setActivityDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Log Activity
                </Button>
              }
            >
              {accountActivities.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No activities logged yet"
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accountActivities.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {a.type} — {a.subject}
                        </p>
                        <p className="text-sm text-slate-900 mt-0.5">
                          {new Date(a.occurredAt).toLocaleString()} ·{" "}
                          {a.createdBy}
                        </p>
                        {a.notes && (
                          <p className="text-sm text-slate-900 mt-1">
                            {a.notes}
                          </p>
                        )}
                      </div>
                      {isCrmAdmin(user) && (
                        <DeleteConfirmDialog
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className={CRM_DELETE_BTN_CLASS}
                              title="Delete activity"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          }
                          title="Delete this activity?"
                          description="This logged activity will be moved to the CRM Recycle Bin."
                          onConfirm={() =>
                            deleteCrmActivity(a.id, a.subject, user)
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4">
          {taskDialog ? (
            <TaskInlineForm
              relatedId={accountId}
              currentUser={currentUser}
              onCancel={() => setTaskDialog(false)}
              onSaved={() => setTaskDialog(false)}
            />
          ) : (
            <SectionShell
              title="Tasks"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setTaskDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </Button>
              }
            >
              {accountTasks.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No tasks yet"
                  description="Add a to-do for this account."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accountTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 flex items-start justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            t.status === "Completed"
                              ? "text-slate-400 line-through"
                              : "text-slate-800",
                          )}
                        >
                          {t.title}
                        </p>
                        <p className="text-sm text-slate-900 mt-1">
                          Due {t.dueDate} · {t.assignedTo} · {t.priority}{" "}
                          priority
                        </p>
                        {t.notes && (
                          <p className="text-sm text-slate-900 mt-0.5">
                            {t.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.status !== "Completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs rounded-lg gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() =>
                              setCrmTaskStatus(
                                t.id,
                                "Completed",
                                currentUser,
                                t.title,
                              ).then(() => celebrateCrm("task.completed"))
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </Button>
                        )}
                        {isCrmAdmin(user) && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="outline"
                                className={CRM_DELETE_BTN_CLASS}
                                title="Delete task"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            }
                            title="Delete this task?"
                            description="This task will be moved to the CRM Recycle Bin."
                            onConfirm={() => deleteCrmTask(t.id, t.title, user)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <SectionShell title="Notes">
            <div className="p-4 space-y-2.5 border-b border-slate-100">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note about this account…"
                className="rounded-xl text-sm"
                rows={2}
              />
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                disabled={!noteDraft.trim() || savingNote}
                onClick={handleAddNote}
              >
                <Send className="h-3.5 w-3.5" /> Add Note
              </Button>
            </div>
            {notes.length === 0 ? (
              <EmptyState icon={StickyNote} title="No notes yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{n.content}</p>
                      <p className="text-sm text-slate-900 mt-1">
                        {n.createdBy} · {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {isCrmAdmin(user) && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className={CRM_DELETE_BTN_CLASS}
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        }
                        title="Delete this note?"
                        description="This note will be moved to the CRM Recycle Bin."
                        onConfirm={() => deleteCrmNote(accountId, n.id, user)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          {documentDialog ? (
            <DocumentInlineForm
              relatedId={accountId}
              currentUser={currentUser}
              onCancel={() => setDocumentDialog(false)}
              onSaved={() => setDocumentDialog(false)}
            />
          ) : (
            <SectionShell
              title="Documents"
              action={
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setDocumentDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Document
                </Button>
              }
            >
              {accountDocuments.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Add a shared-drive or file link — direct file upload isn't wired up yet."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accountDocuments.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-brand-50/40"
                    >
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1"
                      >
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {d.name}
                          </p>
                          <p className="text-sm text-slate-900 mt-0.5">
                            {d.uploadedBy} ·{" "}
                            {new Date(d.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                      </a>
                      {isCrmAdmin(user) && (
                        <DeleteConfirmDialog
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className={CRM_DELETE_BTN_CLASS}
                              title="Delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          }
                          title="Delete this document?"
                          description={`"${d.name}" will be moved to the CRM Recycle Bin (the link itself is unaffected).`}
                          onConfirm={() =>
                            deleteCrmDocument(d.id, d.name, user)
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Quotations — read-only reflection of this account's quotations from the main CRM
            Quotes tab (see Quotes.tsx / QuoteForm.tsx). Quotations can only be created there
            (with this account assigned); here they can only be viewed or deleted. */}
        <TabsContent value="quotations" className="mt-4">
          <SectionShell title="Quotations">
            {accountQuotations.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No quotations yet"
                description="Create a quotation from the main Quotes tab and assign it to this account."
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
                      Number
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Amount
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Valid Until
                    </TableHead>
                    <TableHead className="w-40 font-black text-sm uppercase tracking-wider text-white py-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountQuotations.map((q) => (
                    <TableRow
                      key={q.id}
                      className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                    >
                      <TableCell className="font-semibold text-slate-700 text-base py-1">
                        {q.quotationNumber}
                      </TableCell>
                      <TableCell className="text-base text-slate-900 py-1">
                        ₹{q.amount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-base py-1">
                        <Badge variant="outline" className="text-xs">
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base text-slate-900 py-1">
                        {q.validUntil || "—"}
                      </TableCell>
                      <TableCell className="text-base py-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                            title="View quotation"
                            onClick={() => navigate(`/crm/quotes/${q.id}/edit`)}
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {isCrmAdmin(user) && (
                            <DeleteConfirmDialog
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={CRM_DELETE_BTN_CLASS}
                                  title="Delete quotation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title="Delete this quotation?"
                              description={`Quotation ${q.quotationNumber} will be moved to the CRM Recycle Bin.`}
                              onConfirm={() =>
                                deleteCrmQuotation(
                                  q.id,
                                  q.quotationNumber,
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
            )}
          </SectionShell>
        </TabsContent>

        {/* Products — read-only rollup of every product line item across this account's Deals.
            Products are only ever added via a Deal (see DealDetail.tsx), so this tab surfaces
            that existing relationship rather than inventing a separate account-level catalog;
            here they can only be viewed (open the owning Deal) or deleted. */}
        <TabsContent value="products" className="mt-4">
          {activeTab === "products" && activeOpportunity ? (
            <div className="space-y-4">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl gap-1.5 -ml-2"
                onClick={() => setActiveOpportunity(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
              </Button>
              <OpportunityDrawer
                opportunity={activeOpportunity}
                accountName={account.name}
                open
                onOpenChange={(o) => !o && setActiveOpportunity(null)}
                currentUser={currentUser}
                renderAs="page"
              />
            </div>
          ) : (
            <SectionShell
              title={`Products (${accountDealProducts.length})${accountDealProducts.length ? ` · Subtotal ₹${productsSubtotal.toLocaleString("en-IN")}` : ""}`}
            >
              {accountDealProducts.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No products yet"
                  description="Products are added to this account's Deals — open a Deal to add line items."
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
                        Deal
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Qty
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Unit Price
                      </TableHead>
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Total
                      </TableHead>
                      <TableHead className="w-40 font-black text-sm uppercase tracking-wider text-white py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountDealProducts.map((dp) => {
                      const deal = accountOpportunities.find(
                        (o) => o.id === dp.opportunityId,
                      );
                      return (
                        <TableRow
                          key={dp.id}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                        >
                          <TableCell className="font-semibold text-slate-700 text-base py-1">
                            {dp.productName}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            {deal?.title || "—"}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            {dp.quantity}
                          </TableCell>
                          <TableCell className="text-base text-slate-900 py-1">
                            ₹{dp.unitPrice.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-base font-semibold text-slate-700 py-1">
                            ₹{dp.total.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-base py-1">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                                title="View deal"
                                disabled={!deal}
                                onClick={() =>
                                  deal && setActiveOpportunity(deal)
                                }
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {isCrmAdmin(user) && (
                                <DeleteConfirmDialog
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={CRM_DELETE_BTN_CLASS}
                                      title="Delete product line item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </Button>
                                  }
                                  title="Delete this product line item?"
                                  description={`"${dp.productName}" will be moved to the CRM Recycle Bin.`}
                                  onConfirm={() =>
                                    removeCrmDealProduct(
                                      dp.id,
                                      dp.productName,
                                      user,
                                    )
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
              )}
            </SectionShell>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
            {groupedTimeline.length === 0 ? (
              <EmptyState icon={Flame} title="Nothing recorded yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {groupedTimeline.map((group) => {
                  return (
                    <div key={group.label} className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                          {group.label}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 min-w-0"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="h-2 w-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="text-sm text-slate-900 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {item.deleteAction && isCrmAdmin(user) && (
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                      CRM_DELETE_BTN_CLASS,
                                      "shrink-0",
                                    )}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                }
                                title={item.deleteAction.confirmTitle}
                                description={
                                  item.deleteAction.confirmDescription
                                }
                                onConfirm={item.deleteAction.onConfirm}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shared reschedule form for Meetings and Follow-ups — captures the new date and an optional
 *  reason, appending the previous date to the record's append-only `rescheduleHistory`. */
/** Shared inline reschedule form for Meetings and Follow-ups — captures the new date and an
 *  optional reason, appending the previous date to the record's append-only `rescheduleHistory`.
 *  Renders inline (no Dialog) within the tab that opened it. */
function RescheduleInlineForm({
  currentDate,
  onConfirm,
  onCancel,
  onSaved,
  label,
}: {
  currentDate: string;
  onConfirm: (newDate: string, reason?: string) => Promise<void> | void;
  onCancel: () => void;
  onSaved: () => void;
  label: string;
}) {
  const [newDate, setNewDate] = useState(currentDate);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await onConfirm(newDate, reason || undefined);
      onSaved();
    } catch (err) {
      console.error(`Failed to reschedule ${label}:`, err);
      toast.error(`Failed to reschedule ${label}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <History className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              Reschedule {label}
            </h2>
            <p className="text-sm text-slate-400">
              Pick a new date — the old one is kept in the reschedule history.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              New Date *
            </Label>
            <DatePicker className="h-9" value={newDate} onChange={setNewDate} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Reason (optional)
            </Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being rescheduled?"
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!newDate || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Reschedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Inline "Complete Follow-up" form — renders in place of the Follow-ups tab's list. */
function FollowUpCompleteInlineForm({
  followUp,
  currentUser,
  onCancel,
  onSaved,
}: {
  followUp: CrmFollowUp | null;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!followUp) return;
    setSaving(true);
    try {
      await updateCrmFollowUpStatus(
        followUp.id,
        "COMPLETED",
        currentUser,
        outcome || undefined,
        nextFollowUpAt || undefined,
      );
      celebrateCrm("followup.completed");
      onSaved();
    } catch (err) {
      console.error("Failed to complete follow-up:", err);
      toast.error("Failed to complete follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Complete Follow-up
            </h2>
            <p className="text-sm text-slate-400">
              Record the outcome and, optionally, schedule the next one.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Outcome</Label>
            <Textarea
              rows={3}
              className="rounded-xl"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What happened on this follow-up?"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Next Follow-up Date (optional)
            </Label>
            <DatePicker
              className="h-9"
              value={nextFollowUpAt}
              onChange={setNextFollowUpAt}
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-end gap-2 flex-wrap">
        <Button
          variant="outline"
          className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Mark Completed"}
        </Button>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

type FieldTone =
  | "slate"
  | "brand"
  | "rose"
  | "indigo"
  | "fuchsia"
  | "sky"
  | "purple"
  | "emerald"
  | "blue"
  | "amber";

/** A clearly-visible-but-soft (~35% opacity) hairline in the field's own tone color, used on the
 *  outer card so the box reads as tinted to match its icon without looking like a hard outline. */
const CARD_BORDER: Record<FieldTone, string> = {
  slate: "border-slate-300/70",
  brand: "border-brand-500/35",
  rose: "border-rose-500/35",
  indigo: "border-indigo-500/35",
  fuchsia: "border-fuchsia-500/35",
  sky: "border-sky-500/35",
  purple: "border-purple-500/35",
  emerald: "border-emerald-500/35",
  blue: "border-blue-500/35",
  amber: "border-amber-500/35",
};

/** Polished icon "chip" — soft gradient fill + a top inner highlight and a faint outer shadow,
 *  so the field icons read as gently raised rather than flat colored squares. */
const ICON_CHIP: Record<FieldTone, string> = {
  slate:
    "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 border-slate-200/70",
  brand:
    "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 border-brand-200/60",
  rose: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 border-rose-200/60",
  indigo:
    "bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-500 border-indigo-200/60",
  fuchsia:
    "bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 text-fuchsia-500 border-fuchsia-200/60",
  sky: "bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60",
  purple:
    "bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 border-purple-200/60",
  emerald:
    "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60",
  blue: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 border-blue-200/60",
  amber:
    "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-200/60",
};

/** One labeled value in the Company Information card — icon + label + value, in a small bordered,
 *  softly-shadowed box with a dimensional icon chip in the field's semantic `tone` color. Fields
 *  without a value are hidden unless `showEmpty` is set, in which case they render a muted
 *  "Not available" placeholder instead of inventing data. `href` preserves click-through behavior
 *  (tel:/mailto:/wa.me/https) without altering the underlying account data. */
function InfoField({
  icon: Icon,
  label,
  value,
  href,
  tone = "slate",
  showEmpty = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number;
  href?: string;
  tone?: FieldTone;
  showEmpty?: boolean;
}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  if (!hasValue && !showEmpty) return null;

  const content = (
    <div
      className={cn(
        "flex items-start gap-2.5 min-w-0 h-full rounded-xl border p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
        hasValue
          ? cn(CARD_BORDER[tone], "bg-white")
          : cn(CARD_BORDER.slate, "bg-slate-50/60"),
      )}
    >
      <span
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-lg border shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
          hasValue ? ICON_CHIP[tone] : ICON_CHIP.slate,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
          {label}
        </p>
        <p
          className={cn(
            "text-sm break-words",
            hasValue ? "font-medium text-slate-700" : "text-slate-400",
          )}
        >
          {hasValue ? value : "Not available"}
        </p>
      </div>
    </div>
  );

  if (href && hasValue) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="block rounded-xl transition-shadow hover:shadow-md"
      >
        {content}
      </a>
    );
  }
  return content;
}

/** A first-class communication channel card in the Account 360 header — icon + label + value,
 *  clickable (tel:/mailto:/wa.me/https) only when both a value and href are present. Shows a
 *  muted empty state rather than inventing data when the account has nothing on file. */
function ContactChannel({
  icon: Icon,
  label,
  value,
  href,
  tone = "brand",
  empty = "Not added",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  href?: string;
  tone?: FieldTone;
  empty?: string;
  className?: string;
}) {
  const hasValue = Boolean(value);

  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border p-3 min-w-0 h-full shadow-[0_3px_10px_-3px_rgba(100,116,139,0.3)]",
        hasValue
          ? cn(CARD_BORDER[tone], "bg-white")
          : cn(CARD_BORDER.slate, "bg-slate-50/60"),
      )}
    >
      <span
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-xl border shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
          hasValue ? ICON_CHIP[tone] : ICON_CHIP.slate,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
          {label}
        </p>
        <p
          className={cn(
            "text-sm truncate",
            hasValue ? "font-semibold text-slate-800" : "text-slate-400",
          )}
        >
          {value || empty}
        </p>
      </div>
    </div>
  );

  if (href && hasValue) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={cn(
          "block rounded-2xl transition-shadow hover:shadow-md",
          className,
        )}
      >
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

// --- create dialogs (kept small and local to this page) --------------------------------------

function ContactInlineForm({
  accountId,
  currentUser,
  onCancel,
  onSaved,
}: {
  accountId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CrmContactInput>({
    accountId,
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    whatsapp: "",
    isPrimary: false,
    isDecisionMaker: false,
    createdBy: currentUser,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createCrmContact({ ...form, accountId, createdBy: currentUser });
      onSaved();
    } catch (err) {
      console.error("Failed to add contact:", err);
      toast.error("Failed to add contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Contact</h2>
            <p className="text-sm text-slate-400">
              Add a person you deal with at this account.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Name *</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Designation
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.designation}
              onChange={(e) =>
                setForm((f) => ({ ...f, designation: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Department
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Email</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Phone</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">WhatsApp</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
            <Checkbox
              checked={form.isPrimary}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isPrimary: !!v }))
              }
              id="primary"
            />
            <Label htmlFor="primary" className="text-sm">
              Primary Contact
            </Label>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
            <Checkbox
              checked={form.isDecisionMaker}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isDecisionMaker: !!v }))
              }
              id="dm"
            />
            <Label htmlFor="dm" className="text-sm">
              Decision Maker
            </Label>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.name.trim() || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Add Contact"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OpportunityInlineForm({
  accountId,
  currentUser,
  onCancel,
  onSaved,
}: {
  accountId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CrmOpportunityInput>({
    accountId,
    title: "",
    ownerName: currentUser,
    stage: "new_lead",
    estimatedValue: 0,
    expectedCloseDate: "",
    probability: 10,
    priority: "Medium",
    nextAction: "",
    nextActionDate: "",
  });
  const [saving, setSaving] = useState(false);
  const { boardStages } = useCrmPipelineStages();

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createCrmOpportunity({ ...form, accountId }, currentUser);
      celebrateCrm("deal.created");
      onSaved();
    } catch (err) {
      console.error("Failed to create opportunity:", err);
      toast.error("Failed to create opportunity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              New Opportunity
            </h2>
            <p className="text-sm text-slate-400">
              Start tracking a deal through the pipeline.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Title *</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Bulk fabric order — Q3"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Owner</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.ownerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerName: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Stage</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boardStages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Estimated Value (₹)
            </Label>
            <Input
              className="h-9 rounded-xl"
              type="number"
              value={form.estimatedValue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  estimatedValue: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Expected Close Date
            </Label>
            <DatePicker
              className="h-9"
              value={form.expectedCloseDate}
              onChange={(v) => setForm((f) => ({ ...f, expectedCloseDate: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Probability (%)
            </Label>
            <Input
              className="h-9 rounded-xl"
              type="number"
              min={0}
              max={100}
              value={form.probability}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  probability: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  priority: v as CrmOpportunityInput["priority"],
                }))
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Next Action
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.nextAction}
              onChange={(e) =>
                setForm((f) => ({ ...f, nextAction: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Next Action Date
            </Label>
            <DatePicker
              className="h-9"
              value={form.nextActionDate}
              onChange={(v) => setForm((f) => ({ ...f, nextActionDate: v }))}
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.title.trim() || saving}
            onClick={save}
          >
            {saving ? "Creating…" : "Create Opportunity"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MeetingInlineForm({
  relatedId,
  currentUser,
  onCancel,
  onSaved,
}: {
  relatedId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    mode: "Online" as const,
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    agenda: "",
    participants: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      await createCrmMeeting(
        { relatedType: "account", relatedId, ...form },
        currentUser,
      );
      onSaved();
    } catch (err) {
      console.error("Failed to schedule meeting:", err);
      toast.error("Failed to schedule meeting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Schedule Meeting
            </h2>
            <p className="text-sm text-slate-400">
              Set up a meeting with this account.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, mode: v as typeof f.mode }))
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Onsite">Onsite</SelectItem>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Demo">Demo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Date *</Label>
            <DatePicker
              className="h-9"
              value={form.date}
              onChange={(v) => setForm((f) => ({ ...f, date: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Start Time
            </Label>
            <Input
              className="h-9 rounded-xl"
              type="time"
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">End Time</Label>
            <Input
              className="h-9 rounded-xl"
              type="time"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Location</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Meeting Link
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.meetingLink}
              onChange={(e) =>
                setForm((f) => ({ ...f, meetingLink: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Agenda</Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={form.agenda}
              onChange={(e) =>
                setForm((f) => ({ ...f, agenda: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Participants
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.participants}
              onChange={(e) =>
                setForm((f) => ({ ...f, participants: e.target.value }))
              }
              placeholder="Comma-separated names"
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.date || saving}
            onClick={save}
          >
            {saving ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpInlineForm({
  relatedId,
  currentUser,
  onCancel,
  onSaved,
}: {
  relatedId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    type: "Call" as CrmActivityType,
    scheduledAt: "",
    assignedTo: currentUser,
    priority: "Medium" as const,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.scheduledAt) return;
    setSaving(true);
    try {
      await createCrmFollowUp(
        { relatedType: "account", relatedId, ...form },
        currentUser,
      );
      onSaved();
    } catch (err) {
      console.error("Failed to add follow-up:", err);
      toast.error("Failed to add follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Follow-up</h2>
            <p className="text-sm text-slate-400">
              Schedule a follow-up for this account.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, type: v as CrmActivityType }))
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Scheduled Date *
            </Label>
            <DatePicker
              className="h-9"
              value={form.scheduledAt}
              onChange={(v) => setForm((f) => ({ ...f, scheduledAt: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Assigned To
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.assignedTo}
              onChange={(e) =>
                setForm((f) => ({ ...f, assignedTo: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, priority: v as typeof f.priority }))
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Notes</Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.scheduledAt || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Add Follow-up"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityInlineForm({
  relatedId,
  currentUser,
  onCancel,
  onSaved,
}: {
  relatedId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // datetime-local inputs read/write in the browser's LOCAL time, but toISOString() is UTC —
  // shift by the local timezone offset first so the prefilled value matches the actual local "now".
  const nowLocal = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const [form, setForm] = useState({
    type: "Call" as CrmActivityType,
    subject: "",
    notes: "",
    occurredAt: nowLocal(),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      await logCrmActivity({
        relatedType: "account",
        relatedId,
        type: form.type,
        subject: form.subject,
        notes: form.notes,
        occurredAt: new Date(form.occurredAt).getTime(),
        createdBy: currentUser,
      });
      onSaved();
    } catch (err) {
      console.error("Failed to log activity:", err);
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <ListChecks className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Log Activity</h2>
            <p className="text-sm text-slate-400">
              Record an interaction with this account.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, type: v as CrmActivityType }))
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">When</Label>
            <Input
              className="h-9 rounded-xl"
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, occurredAt: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Subject *
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Notes</Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.subject.trim() || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Log Activity"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskInlineForm({
  relatedId,
  currentUser,
  onCancel,
  onSaved,
}: {
  relatedId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    dueDate: "",
    assignedTo: currentUser,
    priority: "Medium" as const,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim() || !form.dueDate) return;
    setSaving(true);
    try {
      await createCrmTask(
        { relatedType: "account", relatedId, ...form },
        currentUser,
      );
      onSaved();
    } catch (err) {
      console.error("Failed to add task:", err);
      toast.error("Failed to add task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Task</h2>
            <p className="text-sm text-slate-400">
              Add a to-do for this account.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Title *</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Send updated pricing sheet"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Due Date *
            </Label>
            <DatePicker
              className="h-9"
              value={form.dueDate}
              onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Assigned To
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={form.assignedTo}
              onChange={(e) =>
                setForm((f) => ({ ...f, assignedTo: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, priority: v as typeof f.priority }))
              }
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Notes</Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.title.trim() || !form.dueDate || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Add Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentInlineForm({
  relatedId,
  currentUser,
  onCancel,
  onSaved,
}: {
  relatedId: string;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", link: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || !form.link.trim()) return;
    setSaving(true);
    try {
      await addCrmDocument({
        relatedType: "account",
        relatedId,
        ...form,
        uploadedBy: currentUser,
      });
      onSaved();
    } catch (err) {
      console.error("Failed to add document:", err);
      toast.error("Failed to add document. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Document</h2>
            <p className="text-sm text-slate-400">
              Add a shared-drive or file link — direct file upload isn't wired
              up yet.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Name *</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Signed NDA"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Link *</Label>
            <Input
              className="h-9 rounded-xl"
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="Shared drive / storage link"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Notes</Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!form.name.trim() || !form.link.trim() || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Add Document"}
          </Button>
        </div>
      </div>
    </div>
  );
}
