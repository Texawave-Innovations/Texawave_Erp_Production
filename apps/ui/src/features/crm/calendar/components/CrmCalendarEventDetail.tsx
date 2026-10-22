"use client";

import type { CrmCalendarItemType } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
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
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { useCalendarEvent } from "../hooks";

const TYPE_META: Record<
  CrmCalendarItemType,
  { label: string; icon: LucideIcon }
> = {
  meeting: { label: "Meeting", icon: Video },
  followup: { label: "Follow-up", icon: Clock3 },
  task: { label: "Task", icon: Target },
  call: { label: "Call", icon: Phone },
};

function isItemType(v: string): v is CrmCalendarItemType {
  return v in TYPE_META;
}

type Rec = Record<string, unknown>;

function str(r: Rec, key: string): string | null {
  const v = r[key];
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
        {value}
      </p>
    </div>
  );
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Read-only event detail — mirrors legacy CrmCalendarEventDetail.tsx. Reached
 * from the agenda strip or a day's event list; links through to the source
 * account (and deal) but never edits anything. */
export function CrmCalendarEventDetail({
  type,
  id,
}: {
  type: string;
  id: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  // Only ever navigate back to an in-app calendar path.
  const backHref = from?.startsWith("/crm/calendar") ? from : "/crm/calendar";

  const itemType = isItemType(type) ? type : undefined;
  const query = useCalendarEvent(itemType, id);

  const back = (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2 self-start"
      onClick={() => router.push(backHref)}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Calendar
    </Button>
  );

  const notFound = (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
      <CalendarClock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-sm font-bold text-slate-900">Event not found</p>
      <p className="text-sm text-slate-400 mt-1">
        It may have been deleted or its status changed.
      </p>
    </div>
  );

  if (!itemType) {
    return (
      <div className="space-y-6 pb-8">
        {back}
        {notFound}
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="space-y-6 pb-8">
        {back}
        <div className="text-center py-16 text-slate-400 text-sm">
          Loading event…
        </div>
      </div>
    );
  }

  if (query.isError) {
    const err = query.error;
    const denied = err instanceof ApiError && err.isPermissionError;
    return (
      <div className="space-y-6 pb-8">
        {back}
        {err instanceof ApiError && err.isNotFound ? (
          notFound
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-10 text-center">
            <CalendarClock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-900">
              {denied
                ? "You don't have access to this event"
                : "Could not load this event"}
            </p>
            {denied ? (
              <p className="text-sm text-slate-400 mt-1">
                Ask an administrator for the crm.calendar.read permission and
                read access to this record type.
              </p>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => void query.refetch()}
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const ev = query.data;
  const meta = TYPE_META[itemType];
  const Icon = meta.icon;
  const r = ev.record;
  const when = ev.hasTime
    ? new Date(ev.date).toLocaleString(undefined, {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date(`${ev.date.slice(0, 10)}T00:00:00`).toLocaleDateString(
        undefined,
        { weekday: "long", day: "2-digit", month: "long", year: "numeric" },
      );
  const startTime = str(r, "startTime");
  const endTime = str(r, "endTime");
  const eventPath = `/crm/calendar/event/${type}/${id}`;
  const hasMeetingOutcome = [
    "summary",
    "requirements",
    "concerns",
    "competitors",
    "budget",
    "decisionMaker",
    "expectedTimeline",
    "nextStep",
  ].some((k) => str(r, k));

  return (
    <div className="space-y-6 pb-8">
      {back}

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
              <h2 className="text-lg font-bold text-black">{ev.title}</h2>
              {ev.account ? (
                <p className="text-sm font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />{" "}
                  {ev.account.name}
                </p>
              ) : null}
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                {when}
                {startTime
                  ? ` · ${startTime}${endTime ? `–${endTime}` : ""}`
                  : ""}
              </p>
            </div>
          </div>
          {ev.status ? (
            <Badge
              variant="outline"
              className="text-sm px-3 py-1 border shrink-0"
            >
              {ev.status}
            </Badge>
          ) : null}
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

        {itemType === "meeting" ? (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Mode" value={str(r, "mode")} />
            <Field label="Location" value={str(r, "location")} />
            <Field label="Meeting Link" value={str(r, "meetingLink")} />
            <Field label="Participants" value={str(r, "participants")} />
            <div className="md:col-span-3">
              <Field label="Agenda" value={str(r, "agenda")} />
            </div>
            {hasMeetingOutcome ? (
              <>
                <div className="md:col-span-3 pt-1 border-t border-slate-100" />
                <Field label="Summary" value={str(r, "summary")} />
                <Field label="Decision Maker" value={str(r, "decisionMaker")} />
                <Field label="Budget" value={str(r, "budget")} />
                <Field
                  label="Expected Timeline"
                  value={str(r, "expectedTimeline")}
                />
                <Field label="Requirements" value={str(r, "requirements")} />
                <Field label="Concerns" value={str(r, "concerns")} />
                <Field label="Competitors" value={str(r, "competitors")} />
                <Field label="Next Step" value={str(r, "nextStep")} />
                <Field
                  label="Next Follow-up"
                  value={formatDateTime(str(r, "nextFollowUpAt"))}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {itemType === "followup" ? (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Type" value={str(r, "type")} />
            <Field label="Priority" value={str(r, "priority")} />
            <Field label="Assigned To" value={str(r, "assignedTo")} />
            <Field
              label="Next Follow-up"
              value={formatDateTime(str(r, "nextFollowUpAt"))}
            />
            <div className="md:col-span-3">
              <Field label="Notes" value={str(r, "notes")} />
            </div>
            <div className="md:col-span-3">
              <Field label="Outcome" value={str(r, "outcome")} />
            </div>
          </div>
        ) : null}

        {itemType === "task" ? (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Priority" value={str(r, "priority")} />
            <Field label="Assigned To" value={str(r, "assignedTo")} />
            <div className="md:col-span-3">
              <Field label="Notes" value={str(r, "notes")} />
            </div>
          </div>
        ) : null}

        {itemType === "call" ? (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Subject" value={str(r, "subject")} />
            <Field label="Direction" value={str(r, "direction")} />
            <div className="md:col-span-3">
              <Field label="Notes" value={str(r, "notes")} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Related */}
      {ev.account || ev.opportunity ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <UserCheck className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Related Records</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {ev.account ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/crm/accounts/${ev.account?.id}?from=${encodeURIComponent(eventPath)}`,
                  )
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
                    {ev.account.name}{" "}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </p>
                </div>
              </button>
            ) : null}
            {ev.opportunity ? (
              <button
                type="button"
                onClick={() => router.push("/crm/pipeline")}
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
                    {ev.opportunity.title}{" "}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </p>
                </div>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
