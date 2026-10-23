"use client";

import type {
  ActivityType,
  FollowUpPriority,
  MeetingMode,
} from "@texawave-erp/api-types";
import {
  ACTIVITY_TYPES,
  FOLLOW_UP_PRIORITIES,
  MEETING_MODES,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ArrowLeft,
  ArrowRightCircle,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  StickyNote,
  Tag,
  Target,
  Trash2,
  User,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/legacy-ui/tabs";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { celebrateCrm } from "@/features/crm/celebration";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { usePermission } from "@/hooks/usePermission";
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
} from "../../activities/hooks";
import {
  useCreateCrmDocument,
  useCrmDocuments,
  useDeleteCrmDocument,
} from "../../documents/hooks";
import {
  useCreateFollowUp,
  useDeleteFollowUp,
  useFollowUps,
  useUpdateFollowUpStatus,
} from "../../follow-ups/hooks";
import {
  useCreateMeeting,
  useDeleteMeeting,
  useMeetings,
  useUpdateMeetingStatus,
} from "../../meetings/hooks";
import { MeetingCompleteDialog } from "../../yet-to-happen/components/MeetingCompleteDialog";
import {
  useAddLeadNote,
  useDeleteLead,
  useDeleteLeadNote,
  useLead,
  useLeadNotes,
  useLeadTimeline,
  useUpdateLead,
} from "../hooks";
import { LEAD_STATUS_STYLE } from "../sections";

const RATING_STYLE: Record<string, string> = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  Warm: "bg-amber-100 text-amber-700 border-amber-200",
  Cold: "bg-sky-100 text-sky-700 border-sky-200",
};

const AUDIT_FIELD_LABEL: Record<string, string> = {
  leadStatus: "Status",
  rating: "Rating",
  priority: "Priority",
  assignedTo: "Owner",
  leadSource: "Source",
  companyName: "Company",
  prospectName: "Prospect",
};
import { LeadConvertDialog } from "./ConvertLeadDialog";
import { LeadEditPage } from "./LeadEditPage";

const MEETING_STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-600 border-slate-200",
  TENTATIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200",
};

const FOLLOWUP_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  MISSED: "bg-red-50 text-red-700 border-red-200",
};

const FETCH_LIMIT = 100;

interface TimelineItem {
  id: string;
  date: number;
  title: string;
  description?: string | null | undefined;
  onDelete?: (() => Promise<unknown>) | undefined;
}

const DAY_MS = 86_400_000;
function relativeDayLabel(ts: number): string {
  const d = new Date(ts);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(new Date())) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Legacy LeadDetail.tsx ("Lead 360"): header card, Overview / Timeline /
 * Data Privacy tabs, converted-record links, activities / meetings /
 * follow-ups / documents with inline create forms. Notes section, Hot/Warm/Cold
 * rating, last-activity roll-up and the audit-log feed in the Timeline come
 * from the lead notes / timeline endpoints. */
export function LeadDetail({ leadId }: { leadId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canWrite = usePermission([
    "crm.lead.write.own",
    "crm.lead.write.team",
    "crm.lead.write.all",
  ]);
  const canDeleteActivity = usePermission("crm.activity.delete");
  const canDeleteMeeting = usePermission("crm.meeting.delete");
  const canDeleteFollowUp = usePermission("crm.followup.delete");
  const canDeleteDocument = usePermission("crm.document.delete");

  // Leads list URL (with its filter/search/sort/page query) we came from.
  const backParam = searchParams.get("back");
  const leadsFrom =
    backParam && backParam.startsWith("/crm/leads") ? backParam : "/crm/leads";

  const leadQuery = useLead(leadId);
  const related = { relatedType: "lead", relatedId: leadId } as const;
  const activitiesQuery = useActivities({ ...related, limit: FETCH_LIMIT });
  const meetingsQuery = useMeetings({ ...related, limit: FETCH_LIMIT });
  const followUpsQuery = useFollowUps({ ...related, limit: FETCH_LIMIT });
  const documentsQuery = useCrmDocuments({ ...related, limit: FETCH_LIMIT });
  const notesQuery = useLeadNotes(leadId);
  const auditQuery = useLeadTimeline(leadId);
  const addNote = useAddLeadNote();
  const deleteNote = useDeleteLeadNote();
  const [noteDraft, setNoteDraft] = useState("");

  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const deleteActivity = useDeleteActivity();
  const deleteMeeting = useDeleteMeeting();
  const deleteFollowUp = useDeleteFollowUp();
  const deleteDocument = useDeleteCrmDocument();
  const updateMeetingStatus = useUpdateMeetingStatus();
  const updateFollowUpStatus = useUpdateFollowUpStatus();

  const [isEditing, setIsEditing] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [activityForm, setActivityForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState(false);
  const [followUpForm, setFollowUpForm] = useState(false);
  const [documentForm, setDocumentForm] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const row = leadQuery.data;
  const activities = activitiesQuery.data?.data ?? [];
  const meetings = meetingsQuery.data?.data ?? [];
  const followUps = followUpsQuery.data?.data ?? [];
  const documents = documentsQuery.data?.data ?? [];
  const notes = notesQuery.data ?? [];
  const auditLogs = auditQuery.data ?? [];
  const completingMeeting = meetings.find((m) => m.id === completingId) ?? null;

  const tags = useMemo(
    () =>
      (row?.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [row?.tags],
  );

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    if (row) {
      items.push({
        id: "created",
        date: new Date(row.createdAt).getTime(),
        title: "Lead Created",
        description: row.companyName,
      });
    }
    activities.forEach((a) =>
      items.push({
        id: `activity_${a.id}`,
        date: new Date(a.occurredAt).getTime(),
        title: `${a.type} — ${a.subject}`,
        description: a.notes,
        onDelete: canDeleteActivity
          ? () => deleteActivity.mutateAsync(a.id)
          : undefined,
      }),
    );
    meetings.forEach((m) =>
      items.push({
        id: `meeting_${m.id}`,
        date: new Date(m.createdAt).getTime(),
        title: `Meeting (${m.mode}) — ${m.status.replace(/_/g, " ")}`,
        description: m.agenda,
        onDelete: canDeleteMeeting
          ? () => deleteMeeting.mutateAsync(m.id)
          : undefined,
      }),
    );
    followUps.forEach((f) =>
      items.push({
        id: `followup_${f.id}`,
        date: new Date(f.createdAt).getTime(),
        title: `Follow-up (${f.type}) — ${f.effectiveStatus}`,
        description: f.notes,
        onDelete: canDeleteFollowUp
          ? () => deleteFollowUp.mutateAsync(f.id)
          : undefined,
      }),
    );
    documents.forEach((d) =>
      items.push({
        id: `doc_${d.id}`,
        date: new Date(d.uploadedAt).getTime(),
        title: `Document added — ${d.name}`,
        description: undefined,
        onDelete: canDeleteDocument
          ? () => deleteDocument.mutateAsync(d.id)
          : undefined,
      }),
    );
    notes.forEach((n) =>
      items.push({
        id: `note_${n.id}`,
        date: new Date(n.createdAt).getTime(),
        title: `Note by ${n.createdByName ?? "—"}`,
        description: n.content,
        onDelete: canWrite
          ? () => deleteNote.mutateAsync({ id: leadId, noteId: n.id })
          : undefined,
      }),
    );
    // Audit feed (legacy `subscribeCrmAuditLogsForEntity`) — creation and
    // notes already have dedicated entries above.
    auditLogs
      .filter((l) => l.action !== "create" && l.action !== "note_added")
      .forEach((l) => {
        const status = l.changes.find((c) => c.field === "leadStatus");
        items.push({
          id: `audit_${l.id}`,
          date: new Date(l.at).getTime(),
          title:
            l.action === "update"
              ? status
                ? `Status changed — ${status.from ?? "—"} → ${status.to ?? "—"}`
                : "Lead updated"
              : `Lead ${l.action}d`,
          description:
            [
              l.changes
                .filter((c) => c.field !== "leadStatus")
                .map(
                  (c) =>
                    `${AUDIT_FIELD_LABEL[c.field] ?? c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`,
                )
                .join(", "),
              l.by ? `by ${l.by}` : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        });
      });
    return items.sort((a, b) => b.date - a.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation objects are stable enough; deps are the data
  }, [
    notes,
    auditLogs,
    canWrite,
    leadId,
    row,
    activities,
    meetings,
    followUps,
    documents,
    canDeleteActivity,
    canDeleteMeeting,
    canDeleteFollowUp,
    canDeleteDocument,
  ]);

  const groupedTimeline = useMemo(() => {
    const groups: { label: string; items: TimelineItem[] }[] = [];
    timeline.forEach((item) => {
      const label = item.date ? relativeDayLabel(item.date) : "Unknown date";
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    });
    return groups;
  }, [timeline]);

  if (leadQuery.isPending)
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Loading Lead…
      </div>
    );

  if (leadQuery.isError || !row) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
        <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">Lead not found</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 rounded-xl gap-1.5"
          onClick={() => router.push(leadsFrom)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
        </Button>
      </div>
    );
  }

  const setPrivacyField = async (
    input: { emailOptOut: boolean } | { dataProcessingBasis: string },
  ) => {
    try {
      await updateLead.mutateAsync({ id: row.id, input });
    } catch (err) {
      toast.error(errMessage(err, "Failed to save change"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLead.mutateAsync(row.id);
      toast.success("Lead deleted");
      router.push(leadsFrom);
    } catch (err) {
      throw new Error(errMessage(err, "Failed to delete lead"));
    }
  };

  const totalRelated =
    activities.length +
    meetings.length +
    followUps.length +
    documents.length +
    notes.length;

  if (isEditing) {
    return (
      <LeadEditPage
        lead={row}
        onClose={() => setIsEditing(false)}
        backLabel="Back to Lead"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => router.push(leadsFrom)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
        </Button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={!row.email?.trim()}
            asChild={!!row.email?.trim()}
          >
            {row.email?.trim() ? (
              <a href={`mailto:${row.email}`}>
                <Mail className="h-3.5 w-3.5" /> Send Mail
              </a>
            ) : (
              <span>
                <Mail className="h-3.5 w-3.5" /> Send Mail
              </span>
            )}
          </Button>
          {row.linkedAccountId ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
              onClick={() =>
                router.push(`/crm/accounts/${row.linkedAccountId}`)
              }
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> View Account
            </Button>
          ) : (
            canWrite && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                disabled={!row.companyName?.trim()}
                onClick={() => setConvertOpen(true)}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" /> Convert
              </Button>
            )
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {canWrite && (
            <DeleteConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              }
              title={`Delete "${row.companyName || "this lead"}"?`}
              description="This lead will be moved to the CRM Recycle Bin."
              warning={
                row.linkedAccountId
                  ? "This lead has already been converted — deleting it will NOT remove the linked Account, Contact or Opportunity."
                  : totalRelated > 0
                    ? `This lead has ${totalRelated} related record(s) (activities, meetings, follow-ups, documents) — those are not moved to the Recycle Bin with it.`
                    : undefined
              }
              confirmLabel="Delete"
              onConfirm={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 shadow-xl p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="p-3 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200 shrink-0">
              <User className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold text-black">
                {row.prospectName || "Unnamed Lead"}
              </h2>
              <p className="text-base font-bold text-slate-600">
                {row.companyName || "No company"}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-base font-bold text-slate-600">
                {row.title && <span>{row.title}</span>}
                {(row.city || row.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />{" "}
                    {[row.city, row.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {row.assignedTo && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-blue-500" />{" "}
                    {row.assignedTo}
                  </span>
                )}
                {row.contactNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" />{" "}
                    {row.contactNumber}
                  </span>
                )}
                {row.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-purple-500" /> {row.email}
                  </span>
                )}
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full"
                    >
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {row.rating && (
              <Badge
                className={cn(
                  "border text-sm px-3 py-1 pointer-events-none",
                  RATING_STYLE[row.rating] ?? "",
                )}
              >
                {row.rating}
              </Badge>
            )}
            {row.leadStatus && (
              <Badge
                className={cn(
                  "border text-sm px-3 py-1 pointer-events-none",
                  LEAD_STATUS_STYLE[row.leadStatus] ||
                    "bg-slate-100 text-slate-600 border-slate-200",
                )}
              >
                {row.leadStatus.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max">
            <TabsTrigger
              value="overview"
              className="rounded-xl gap-1.5 text-black data-[state=active]:text-brand-700"
            >
              <User className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-xl gap-1.5 text-black data-[state=active]:text-brand-700"
            >
              <Clock3 className="h-3.5 w-3.5" /> Timeline
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="rounded-xl gap-1.5 text-black data-[state=active]:text-brand-700"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Data Privacy
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-5">
          <SectionShell title="Overview">
            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <InfoField
                icon={Users}
                label="Lead Owner"
                value={row.assignedTo}
                color="bg-blue-50 text-blue-600 border-blue-200"
              />
              <InfoField
                icon={Mail}
                label="Email"
                value={row.email}
                color="bg-purple-50 text-purple-600 border-purple-200"
              />
              <InfoField
                icon={Phone}
                label="Phone"
                value={row.contactNumber}
                color="bg-emerald-50 text-emerald-600 border-emerald-200"
              />
              <InfoField
                icon={PhoneCall}
                label="Mobile"
                value={row.mobile}
                color="bg-amber-50 text-amber-600 border-amber-200"
              />
              <InfoField
                icon={Building2}
                label="Company"
                value={row.companyName}
                color="bg-rose-50 text-rose-600 border-rose-200"
              />
              <InfoField
                icon={User}
                label="Title"
                value={row.title}
                color="bg-cyan-50 text-cyan-600 border-cyan-200"
              />
              <InfoField
                icon={Globe}
                label="Website"
                value={row.domain}
                color="bg-indigo-50 text-indigo-600 border-indigo-200"
              />
              <InfoField
                icon={Target}
                label="Lead Source"
                value={row.leadSource}
                color="bg-orange-50 text-orange-600 border-orange-200"
              />
              <InfoField
                icon={Briefcase}
                label="Industry"
                value={row.industry}
                color="bg-teal-50 text-teal-600 border-teal-200"
              />
              <InfoField
                icon={Building2}
                label="Annual Revenue"
                value={row.annualRevenue}
                color="bg-pink-50 text-pink-600 border-pink-200"
              />
              <InfoField
                icon={Target}
                label="Rating"
                value={row.rating}
                color="bg-red-50 text-red-600 border-red-200"
              />
              <InfoField
                icon={Clock3}
                label="Last Activity"
                value={
                  row.lastActivityAt
                    ? new Date(row.lastActivityAt).toLocaleString("en-IN")
                    : null
                }
                color="bg-slate-50 text-slate-600 border-slate-200"
              />
              <InfoField
                icon={User}
                label="Created By"
                value={row.createdByName}
                color="bg-lime-50 text-lime-600 border-lime-200"
              />
              <InfoField
                icon={Users}
                label="No. of Employees"
                value={row.numberOfEmployees}
                color="bg-violet-50 text-violet-600 border-violet-200"
              />
              <InfoField
                icon={MapPin}
                label="Address"
                value={[
                  row.addressStreet,
                  row.city,
                  row.state,
                  row.postalCode,
                  row.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
                color="bg-sky-50 text-sky-600 border-sky-200"
              />
            </div>
          </SectionShell>

          {/* Best time insights — neutral empty state; no call/email timing source exists yet */}
          <SectionShell title="Best Time Insights">
            <div className="p-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center">
                <PhoneCall className="h-5 w-5 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  Best time for Call
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  No best time available
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center">
                <Mail className="h-5 w-5 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  Best time for Email
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  No best time available
                </p>
              </div>
            </div>
          </SectionShell>

          {/* Converted records */}
          <SectionShell title="Converted Records">
            {!row.linkedAccountId ? (
              <EmptyState
                icon={ArrowRightCircle}
                title="Not converted yet"
                description="Convert this lead to create its Account, Contact and optional Deal."
              />
            ) : (
              <div className="p-4 grid sm:grid-cols-3 gap-3">
                <RelatedLink
                  icon={Building2}
                  label="Account"
                  value={row.linkedAccount?.name ?? String(row.linkedAccountId)}
                  onClick={() =>
                    router.push(`/crm/accounts/${row.linkedAccountId}`)
                  }
                  color="bg-blue-50 text-blue-600 border-blue-200"
                />
                <RelatedLink
                  icon={User}
                  label="Contact"
                  value={row.linkedContact?.name}
                  onClick={
                    row.linkedContact
                      ? () => router.push(`/crm/contacts`)
                      : undefined
                  }
                  color="bg-purple-50 text-purple-600 border-purple-200"
                />
                <RelatedLink
                  icon={Briefcase}
                  label="Deal"
                  value={row.linkedOpportunity?.title}
                  onClick={
                    row.linkedOpportunity
                      ? () =>
                          router.push(`/crm/accounts/${row.linkedAccountId}`)
                      : undefined
                  }
                  color="bg-amber-50 text-amber-600 border-amber-200"
                />
              </div>
            )}
          </SectionShell>

          {/* Notes */}
          <SectionShell title="Notes">
            {canWrite && (
              <div className="p-4 space-y-2 border-b border-slate-100">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note about this lead…"
                  className="rounded-xl text-sm"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  disabled={!noteDraft.trim() || addNote.isPending}
                  onClick={async () => {
                    try {
                      await addNote.mutateAsync({
                        id: leadId,
                        content: noteDraft.trim(),
                      });
                      setNoteDraft("");
                    } catch (err) {
                      toast.error(errMessage(err, "Failed to add note"));
                    }
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Add Note
                </Button>
              </div>
            )}
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
                      <p className="text-sm text-black whitespace-pre-wrap">
                        {n.content}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {n.createdByName ?? "—"} ·{" "}
                        {new Date(n.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    {canWrite && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 rounded-lg border-red-200 text-red-600 bg-red-50/50 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                        title="Delete this note?"
                        description="This note will be removed from the lead."
                        onConfirm={async () => {
                          await deleteNote.mutateAsync({
                            id: leadId,
                            noteId: n.id,
                          });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          {/* Activities */}
          <SectionShell
            title="Open & Closed Activities"
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setActivityForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" /> Log Activity
              </Button>
            }
          >
            {activityForm && (
              <ActivityInlineForm
                leadId={leadId}
                onDone={() => setActivityForm(false)}
              />
            )}
            {activities.length === 0 ? (
              <EmptyState icon={Target} title="No activities logged yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {a.type} — {a.subject}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {new Date(a.occurredAt).toLocaleString()}
                      </p>
                      {a.notes && (
                        <p className="text-sm text-black mt-1">{a.notes}</p>
                      )}
                    </div>
                    {canDeleteActivity && (
                      <DeleteConfirmDialog
                        trigger={<IconDeleteButton />}
                        title="Delete this activity?"
                        description="This logged activity will be moved to the CRM Recycle Bin."
                        onConfirm={async () => {
                          await deleteActivity.mutateAsync(a.id);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          {/* Meetings */}
          <SectionShell
            title="Meetings"
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setMeetingForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" /> Schedule Meeting
              </Button>
            }
          >
            {meetingForm && (
              <MeetingInlineForm
                leadId={leadId}
                onDone={() => setMeetingForm(false)}
              />
            )}
            {meetings.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No meetings yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {meetings.map((m) => {
                  const isDone =
                    m.status === "COMPLETED" || m.status === "CANCELLED";
                  return (
                    <div key={m.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {m.mode} meeting — {m.meetingDate.slice(0, 10)}
                            {m.startTime ? ` at ${m.startTime}` : ""}
                          </p>
                          {m.agenda && (
                            <p className="text-sm text-black mt-1">
                              {m.agenda}
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
                            "border shrink-0 pointer-events-none",
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
                              className="h-7 px-2.5 text-xs rounded-lg gap-1 border-emerald-200 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100"
                              onClick={() => setCompletingId(m.id)}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs rounded-lg gap-1 border-red-200 text-red-600 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                              onClick={() =>
                                updateMeetingStatus.mutate(
                                  {
                                    id: m.id,
                                    input: { status: "CANCELLED" },
                                  },
                                  {
                                    onError: (e) =>
                                      toast.error(
                                        errMessage(
                                          e,
                                          "Failed to cancel meeting",
                                        ),
                                      ),
                                  },
                                )
                              }
                            >
                              <XCircle className="h-3 w-3" /> Cancel
                            </Button>
                          </>
                        )}
                        {canDeleteMeeting && (
                          <DeleteConfirmDialog
                            trigger={<IconDeleteButton small />}
                            title="Delete this meeting?"
                            description="This meeting will be moved to the CRM Recycle Bin."
                            onConfirm={async () => {
                              await deleteMeeting.mutateAsync(m.id);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionShell>

          {/* Follow-ups */}
          <SectionShell
            title="Follow-ups"
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setFollowUpForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" /> Add Follow-up
              </Button>
            }
          >
            {followUpForm && (
              <FollowUpInlineForm
                leadId={leadId}
                defaultAssignee={row.assignedTo ?? ""}
                onDone={() => setFollowUpForm(false)}
              />
            )}
            {followUps.length === 0 ? (
              <EmptyState icon={Clock3} title="No follow-ups yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {followUps.map((f) => {
                  const isDone =
                    f.status === "COMPLETED" || f.status === "CANCELLED";
                  return (
                    <div key={f.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {f.type} — {f.scheduledAt.slice(0, 10)}
                          </p>
                          <p className="text-sm text-black mt-1">
                            Assigned to {f.assignedTo} · {f.priority} priority
                          </p>
                          {f.notes && (
                            <p className="text-sm text-black mt-0.5">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={cn(
                            "border shrink-0 text-sm px-3 py-1 pointer-events-none",
                            FOLLOWUP_STATUS_STYLE[f.effectiveStatus],
                          )}
                        >
                          {f.effectiveStatus}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isDone && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs rounded-lg gap-1 border-emerald-200 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100"
                              onClick={() =>
                                updateFollowUpStatus.mutate(
                                  { id: f.id, input: { status: "COMPLETED" } },
                                  {
                                    onSuccess: () =>
                                      celebrateCrm("followup.completed"),
                                    onError: (e) =>
                                      toast.error(
                                        errMessage(e, "Failed to update"),
                                      ),
                                  },
                                )
                              }
                            >
                              <CheckCircle2 className="h-3 w-3" /> Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs rounded-lg gap-1 border-red-200 text-red-600 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                              onClick={() =>
                                updateFollowUpStatus.mutate(
                                  { id: f.id, input: { status: "CANCELLED" } },
                                  {
                                    onError: (e) =>
                                      toast.error(
                                        errMessage(e, "Failed to update"),
                                      ),
                                  },
                                )
                              }
                            >
                              <XCircle className="h-3 w-3" /> Cancel
                            </Button>
                          </>
                        )}
                        {canDeleteFollowUp && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            }
                            title="Delete this follow-up?"
                            description="This follow-up will be moved to the CRM Recycle Bin."
                            onConfirm={async () => {
                              await deleteFollowUp.mutateAsync(f.id);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionShell>

          {/* Documents */}
          <SectionShell
            title="Attachments / Documents"
            action={
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setDocumentForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" /> Add Document
              </Button>
            }
          >
            {documentForm && (
              <DocumentInlineForm
                leadId={leadId}
                onDone={() => setDocumentForm(false)}
              />
            )}
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Add a shared-drive or file link."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((d) => (
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
                        <p className="text-sm text-slate-400 mt-0.5">
                          {new Date(d.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                    </a>
                    {canDeleteDocument && (
                      <DeleteConfirmDialog
                        trigger={<IconDeleteButton />}
                        title="Delete this document?"
                        description={`"${d.name}" will be moved to the CRM Recycle Bin.`}
                        onConfirm={async () => {
                          await deleteDocument.mutateAsync(d.id);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
            {groupedTimeline.length === 0 ? (
              <EmptyState icon={Clock3} title="Nothing recorded yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {groupedTimeline.map((group) => {
                  const deletableItems = group.items.filter(
                    (item) => item.onDelete,
                  );
                  return (
                    <div key={group.label} className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-black">
                          {group.label}
                        </p>
                        {deletableItems.length > 0 && (
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs rounded-lg gap-1 shrink-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            }
                            title={`Delete all entries from ${group.label}?`}
                            description="Activities, meetings, follow-ups and documents from this date will be moved to the CRM Recycle Bin."
                            confirmLabel="Delete"
                            onConfirm={async () => {
                              await Promise.all(
                                deletableItems.map((item) => item.onDelete?.()),
                              );
                            }}
                          />
                        )}
                      </div>
                      <div className="space-y-3">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-3">
                            <span className="h-2 w-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-sm text-black mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
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

        {/* Data Privacy */}
        <TabsContent value="privacy" className="mt-4">
          <SectionShell title="Data Privacy">
            <div className="p-4 space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-black">
                  Email Opt Out
                </Label>
                <Select
                  value={row.emailOptOut ? "Yes" : "No"}
                  disabled={!canWrite}
                  onValueChange={(v) =>
                    void setPrivacyField({ emailOptOut: v === "Yes" })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No — may be emailed</SelectItem>
                    <SelectItem value="Yes">Yes — opted out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-black">
                  Data Processing Basis
                </Label>
                <Select
                  value={row.dataProcessingBasis || ""}
                  disabled={!canWrite}
                  onValueChange={(v) =>
                    void setPrivacyField({ dataProcessingBasis: v })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consent">Consent</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Legitimate Interest">
                      Legitimate Interest
                    </SelectItem>
                    <SelectItem value="Legal Obligation">
                      Legal Obligation
                    </SelectItem>
                    <SelectItem value="Not Specified">Not Specified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-black">
                This governs whether marketing emails may be sent to this lead
                and records the legal basis under which their data is held.
              </p>
            </div>
          </SectionShell>
        </TabsContent>
      </Tabs>

      <LeadConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={row}
        navigateToAccountOnSuccess={false}
      />

      <MeetingCompleteDialog
        meeting={completingMeeting}
        open={completingId !== null}
        onOpenChange={(o) => {
          if (!o) setCompletingId(null);
        }}
      />
    </div>
  );
}

function IconDeleteButton({ small = false }: { small?: boolean }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        "p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg shrink-0",
        small ? "h-7 w-7" : "h-8 w-8",
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  color = "bg-brand-50 text-brand-600 border-brand-200",
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null | undefined;
  color?: string;
}) {
  const borderColor =
    color.split(" ").find((c) => c.startsWith("border-")) || "border-slate-200";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border p-3",
        borderColor,
      )}
    >
      <span
        className={cn(
          "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide text-black">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-600 truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function RelatedLink({
  icon: Icon,
  label,
  value,
  onClick,
  color = "bg-brand-50 text-brand-600 border-brand-200",
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null | undefined;
  onClick?: (() => void) | undefined;
  color?: string;
}) {
  const borderColor =
    color.split(" ").find((c) => c.startsWith("border-")) || "border-slate-200";
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors",
        borderColor,
        onClick
          ? "hover:bg-brand-50/40 cursor-pointer"
          : "cursor-default opacity-60",
      )}
    >
      <span
        className={cn(
          "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide text-black">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-600 truncate">
          {value || "—"}
        </p>
      </div>
    </button>
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
        <h3 className="text-base font-bold text-black">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const CANCEL_BTN =
  "rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100";

// --- create forms, scoped to this Lead (relatedType: "lead") --------------

function ActivityInlineForm({
  leadId,
  onDone,
}: {
  leadId: number;
  onDone: () => void;
}) {
  const nowLocal = () => new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    type: "Call" as ActivityType,
    subject: "",
    notes: "",
    occurredAt: nowLocal(),
  });
  const createMutation = useCreateActivity();

  const save = async () => {
    if (!form.subject.trim()) return;
    try {
      await createMutation.mutateAsync({
        relatedType: "lead",
        relatedId: leadId,
        type: form.type,
        subject: form.subject.trim(),
        notes: form.notes.trim() || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      onDone();
    } catch (err) {
      toast.error(errMessage(err, "Failed to log activity"));
    }
  };

  return (
    <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, type: v as ActivityType }))
            }
          >
            <SelectTrigger className="bg-white">
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
          <Label>When</Label>
          <Input
            className="bg-white"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, occurredAt: e.target.value }))
            }
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Subject *</Label>
          <Input
            className="bg-white"
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            className="bg-white"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className={CANCEL_BTN} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="rounded-xl"
          disabled={!form.subject.trim() || createMutation.isPending}
          onClick={() => void save()}
        >
          {createMutation.isPending ? "Saving…" : "Log Activity"}
        </Button>
      </div>
    </div>
  );
}

function MeetingInlineForm({
  leadId,
  onDone,
}: {
  leadId: number;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    mode: "Online" as MeetingMode,
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    agenda: "",
    participants: "",
  });
  const createMutation = useCreateMeeting();

  const save = async () => {
    if (!form.date) return;
    const opt = (v: string) => v.trim() || undefined;
    try {
      await createMutation.mutateAsync({
        relatedType: "lead",
        relatedId: leadId,
        mode: form.mode,
        meetingDate: form.date,
        startTime: opt(form.startTime),
        endTime: opt(form.endTime),
        location: opt(form.location),
        meetingLink: opt(form.meetingLink),
        agenda: opt(form.agenda),
        participants: opt(form.participants),
      });
      onDone();
    } catch (err) {
      toast.error(errMessage(err, "Failed to schedule meeting"));
    }
  };

  return (
    <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select
            value={form.mode}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, mode: v as MeetingMode }))
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEETING_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date *</Label>
          <DatePicker
            className="bg-white"
            value={form.date}
            onChange={(v) => setForm((f) => ({ ...f, date: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Start Time</Label>
          <Input
            className="bg-white"
            type="time"
            value={form.startTime}
            onChange={(e) =>
              setForm((f) => ({ ...f, startTime: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>End Time</Label>
          <Input
            className="bg-white"
            type="time"
            value={form.endTime}
            onChange={(e) =>
              setForm((f) => ({ ...f, endTime: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Input
            className="bg-white"
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Meeting Link</Label>
          <Input
            className="bg-white"
            value={form.meetingLink}
            onChange={(e) =>
              setForm((f) => ({ ...f, meetingLink: e.target.value }))
            }
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Agenda</Label>
          <Textarea
            className="bg-white"
            rows={2}
            value={form.agenda}
            onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Participants</Label>
          <Input
            className="bg-white"
            value={form.participants}
            onChange={(e) =>
              setForm((f) => ({ ...f, participants: e.target.value }))
            }
            placeholder="Comma-separated names"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className={CANCEL_BTN} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="rounded-xl"
          disabled={!form.date || createMutation.isPending}
          onClick={() => void save()}
        >
          {createMutation.isPending ? "Scheduling…" : "Schedule"}
        </Button>
      </div>
    </div>
  );
}

function FollowUpInlineForm({
  leadId,
  defaultAssignee,
  onDone,
}: {
  leadId: number;
  defaultAssignee: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    type: "Call" as ActivityType,
    scheduledAt: "",
    assignedTo: defaultAssignee,
    priority: "Medium" as FollowUpPriority,
    notes: "",
  });
  const createMutation = useCreateFollowUp();
  const canSave = form.scheduledAt && form.assignedTo.trim();

  const save = async () => {
    if (!canSave) return;
    try {
      await createMutation.mutateAsync({
        relatedType: "lead",
        relatedId: leadId,
        type: form.type,
        scheduledAt: form.scheduledAt,
        assignedTo: form.assignedTo.trim(),
        priority: form.priority,
        notes: form.notes.trim() || undefined,
      });
      onDone();
    } catch (err) {
      toast.error(errMessage(err, "Failed to add follow-up"));
    }
  };

  return (
    <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, type: v as ActivityType }))
            }
          >
            <SelectTrigger className="bg-white">
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
          <Label>Scheduled Date *</Label>
          <DatePicker
            className="bg-white"
            value={form.scheduledAt}
            onChange={(v) => setForm((f) => ({ ...f, scheduledAt: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Assigned To *</Label>
          <Input
            className="bg-white"
            value={form.assignedTo}
            onChange={(e) =>
              setForm((f) => ({ ...f, assignedTo: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={form.priority}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, priority: v as FollowUpPriority }))
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            className="bg-white"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className={CANCEL_BTN} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="rounded-xl"
          disabled={!canSave || createMutation.isPending}
          onClick={() => void save()}
        >
          {createMutation.isPending ? "Saving…" : "Add Follow-up"}
        </Button>
      </div>
    </div>
  );
}

function DocumentInlineForm({
  leadId,
  onDone,
}: {
  leadId: number;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: "", link: "", notes: "" });
  const createMutation = useCreateCrmDocument();

  const save = async () => {
    if (!form.name.trim() || !form.link.trim()) return;
    try {
      await createMutation.mutateAsync({
        relatedType: "lead",
        relatedId: leadId,
        name: form.name.trim(),
        link: form.link.trim(),
        notes: form.notes.trim() || undefined,
      });
      onDone();
    } catch (err) {
      toast.error(errMessage(err, "Failed to add document"));
    }
  };

  return (
    <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            className="bg-white"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Signed NDA"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Link *</Label>
          <Input
            className="bg-white"
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            placeholder="Shared drive / storage link"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            className="bg-white"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className={CANCEL_BTN} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="rounded-xl"
          disabled={
            !form.name.trim() || !form.link.trim() || createMutation.isPending
          }
          onClick={() => void save()}
        >
          {createMutation.isPending ? "Saving…" : "Add Document"}
        </Button>
      </div>
    </div>
  );
}
