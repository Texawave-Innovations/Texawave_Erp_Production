// CRM Calendar — dedicated event detail page. Reached by clicking a card in the "Accounts &
// Pipeline — next 14 days" strip on CrmCalendar.tsx. Purely a read view over the existing CRM
// Core Domain records (meetings/followUps/tasks/activities) already loaded by `useCrmDomainData`
// — no new Firebase path, no duplicate model; only the record type read differs based on the
// `:type` route param.
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Clock3,
  Phone,
  Target,
  UserCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrmDomainData } from "../domain/useCrmDomainData";
import { parseLooseDate } from "../notifications/dateUtils";
import type { CalendarDomainItemType } from "./CrmCalendar";

const TYPE_META: Record<
  CalendarDomainItemType,
  { label: string; icon: LucideIcon }
> = {
  meeting: { label: "Meeting", icon: Video },
  followup: { label: "Follow-up", icon: Clock3 },
  task: { label: "Task", icon: Target },
  call: { label: "Call", icon: Phone },
};

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
        {value}
      </p>
    </div>
  );
}

export default function CrmCalendarEventDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const calendarFrom =
    (location.state as { from?: string } | null)?.from || "/crm/calendar";

  const {
    meetings,
    followUps,
    tasks,
    activities,
    accounts,
    opportunities,
    loading,
  } = useCrmDomainData();

  const itemType =
    (type as CalendarDomainItemType) in TYPE_META
      ? (type as CalendarDomainItemType)
      : undefined;
  const meta = itemType ? TYPE_META[itemType] : undefined;

  const meeting =
    itemType === "meeting" ? meetings.find((m) => m.id === id) : undefined;
  const followUp =
    itemType === "followup" ? followUps.find((f) => f.id === id) : undefined;
  const task = itemType === "task" ? tasks.find((t) => t.id === id) : undefined;
  const call =
    itemType === "call" ? activities.find((a) => a.id === id) : undefined;

  const record = meeting || followUp || task || call;
  const relatedId = record?.relatedId;
  const relatedType = record?.relatedType;
  const account = relatedId
    ? accounts.find((a) => a.id === relatedId)
    : undefined;
  const opportunity =
    relatedType === "opportunity" && relatedId
      ? opportunities.find((o) => o.id === relatedId)
      : undefined;
  const accountForOpportunity = opportunity
    ? accounts.find((a) => a.id === opportunity.accountId)
    : undefined;

  const backButton = (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2"
      onClick={() => navigate(calendarFrom)}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Calendar
    </Button>
  );

  if (loading)
    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="text-center py-16 text-slate-400 text-sm">
          Loading event…
        </div>
      </div>
    );

  if (!meta || !record) {
    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-900">Event not found</p>
          <p className="text-sm text-slate-400 mt-1">
            It may have been deleted or its status changed.
          </p>
        </div>
      </div>
    );
  }

  const Icon = meta.icon;
  const title = meeting
    ? meeting.mode === "Demo"
      ? "Demo"
      : `${meeting.mode} Meeting`
    : followUp
      ? `${followUp.type} Follow-up`
      : task
        ? task.title
        : call
          ? call.subject
          : meta.label;
  const status =
    meeting?.status.replace(/_/g, " ") || followUp?.status || task?.status;
  const dateValue = meeting?.date || followUp?.scheduledAt || task?.dueDate;
  const dateObj = dateValue
    ? parseLooseDate(dateValue)
    : call
      ? new Date(call.occurredAt)
      : undefined;
  const linkedAccountName = account?.name || accountForOpportunity?.name;
  const linkedAccountId = account?.id || accountForOpportunity?.id;

  return (
    <div className="space-y-6 pb-8">
      {backButton}

      {/* Header */}
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
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-black">{title}</h2>
              {linkedAccountName && (
                <p className="text-sm font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />{" "}
                  {linkedAccountName}
                </p>
              )}
              {dateObj && (
                <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                  {format(dateObj, "EEEE, dd MMMM yyyy")}
                  {meeting?.startTime
                    ? ` · ${meeting.startTime}${meeting.endTime ? `–${meeting.endTime}` : ""}`
                    : call
                      ? ` · ${format(dateObj, "hh:mm a")}`
                      : ""}
                </p>
              )}
            </div>
          </div>
          {status && (
            <Badge
              variant="outline"
              className="text-sm px-3 py-1 border shrink-0"
            >
              {status}
            </Badge>
          )}
        </div>
      </div>

      {/* Type-specific details */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-black">{meta.label} Details</h3>
        </div>

        {meeting && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Mode" value={meeting.mode} />
            <Field label="Location" value={meeting.location} />
            <Field label="Meeting Link" value={meeting.meetingLink} />
            <Field label="Participants" value={meeting.participants} />
            <div className="md:col-span-3">
              <Field label="Agenda" value={meeting.agenda} />
            </div>
            {(meeting.summary ||
              meeting.requirements ||
              meeting.concerns ||
              meeting.competitors ||
              meeting.budget ||
              meeting.decisionMaker ||
              meeting.expectedTimeline ||
              meeting.nextStep) && (
              <>
                <div className="md:col-span-3 pt-1 border-t border-slate-100" />
                <Field label="Summary" value={meeting.summary} />
                <Field label="Decision Maker" value={meeting.decisionMaker} />
                <Field label="Budget" value={meeting.budget} />
                <Field
                  label="Expected Timeline"
                  value={meeting.expectedTimeline}
                />
                <Field label="Requirements" value={meeting.requirements} />
                <Field label="Concerns" value={meeting.concerns} />
                <Field label="Competitors" value={meeting.competitors} />
                <Field label="Next Step" value={meeting.nextStep} />
                <Field label="Next Follow-up" value={meeting.nextFollowUpAt} />
              </>
            )}
          </div>
        )}

        {followUp && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Type" value={followUp.type} />
            <Field label="Priority" value={followUp.priority} />
            <Field label="Assigned To" value={followUp.assignedTo} />
            <Field label="Next Follow-up" value={followUp.nextFollowUpAt} />
            <div className="md:col-span-3">
              <Field label="Notes" value={followUp.notes} />
            </div>
            <div className="md:col-span-3">
              <Field label="Outcome" value={followUp.outcome} />
            </div>
          </div>
        )}

        {task && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Priority" value={task.priority} />
            <Field label="Assigned To" value={task.assignedTo} />
            <div className="md:col-span-3">
              <Field label="Notes" value={task.notes} />
            </div>
          </div>
        )}

        {call && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Subject" value={call.subject} />
            <Field label="Direction" value={call.direction} />
            <Field label="Logged By" value={call.createdBy} />
            <div className="md:col-span-3">
              <Field label="Notes" value={call.notes} />
            </div>
          </div>
        )}
      </div>

      {/* Related */}
      {(linkedAccountId || opportunity) && (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <UserCheck className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Related Records</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {linkedAccountId && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/crm/accounts/${linkedAccountId}`, {
                    state: {
                      from: `/crm/calendar/event/${type}/${id}`,
                      label: meta.label,
                    },
                  })
                }
                className="flex items-center gap-2.5 rounded-2xl border border-slate-200 p-3 text-left hover:bg-brand-50/40 transition-colors"
              >
                <span className="h-9 w-9 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-black">
                    Account
                  </p>
                  <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-1">
                    {linkedAccountName}{" "}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </p>
                </div>
              </button>
            )}
            {opportunity && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/crm/pipeline/${opportunity.id}`, {
                    state: {
                      from: `/crm/calendar/event/${type}/${id}`,
                      label: meta.label,
                    },
                  })
                }
                className="flex items-center gap-2.5 rounded-2xl border border-slate-200 p-3 text-left hover:bg-brand-50/40 transition-colors"
              >
                <span className="h-9 w-9 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-black">
                    Deal
                  </p>
                  <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-1">
                    {opportunity.title}{" "}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
