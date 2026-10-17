// Features 4, 5, 6, 7 — Company / Lead 360° View, Activity Timeline, Priority + Lead
// Classification, and Notes. Aggregates/reads existing CRM source data (never overwrites it)
// and layers the new metadata/notes/audit data (isolated Firebase paths) on top.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Globe2,
  User,
  Mail,
  Phone,
  CalendarClock,
  Clock3,
  StickyNote,
  Flame,
  ListChecks,
  Plus,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useCrmSourceData } from "./useCrmSourceData";
import { buildActivities, buildCompanyProfiles } from "./unify";
import {
  EmptyState,
  PriorityBadge,
  SectionCard,
  SourceTag,
  TemperatureBadge,
} from "./components";
import { formatShortDate, relativeDayLabel } from "./shared";
import { TAB_META } from "./tabMeta";
import {
  subscribeCrmMetadataForCompany,
  setCrmPriority,
  setCrmTemperature,
} from "./metadataService";
import { addCrmNote, subscribeCrmNotes } from "./notesService";
import { subscribeCrmAuditLogsForCompany } from "./auditService";
import {
  CrmAuditLogEntry,
  CrmMetadata,
  CrmNote,
  CrmPriority,
  CrmTemperature,
} from "./types";

const PRIORITIES: CrmPriority[] = ["High", "Medium", "Low"];
const TEMPERATURES: CrmTemperature[] = ["Hot", "Warm", "Cold"];

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description?: string;
  icon: "source" | "note" | "priority" | "temp";
  sourceRoute?: string;
}

export default function CompanyDetail() {
  const { companyKey = "" } = useParams<{ companyKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";

  const { sources, loading } = useCrmSourceData();
  const activities = useMemo(() => buildActivities(sources), [sources]);
  const profiles = useMemo(
    () => buildCompanyProfiles(activities),
    [activities],
  );
  const profile = profiles.get(companyKey);

  const [metadata, setMetadata] = useState<CrmMetadata | undefined>();
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<CrmAuditLogEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(
    () => subscribeCrmMetadataForCompany(companyKey, setMetadata),
    [companyKey],
  );
  useEffect(() => subscribeCrmNotes(companyKey, setNotes), [companyKey]);
  useEffect(
    () => subscribeCrmAuditLogsForCompany(companyKey, setAuditLogs),
    [companyKey],
  );

  const companyAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.action !== "note_added"),
    [auditLogs],
  );

  const timeline: TimelineEvent[] = useMemo(() => {
    if (!profile) return [];
    const events: TimelineEvent[] = [];

    profile.activities.forEach((a) => {
      if (!a.entryDate) return;
      const meta = TAB_META[a.sourceTab];
      let title = `${meta.label} entry logged`;
      if (a.sourceTab === "accountsMiningSheet")
        title = "Lead Added (Accounts Mining)";
      else if (a.sourceTab === "coldCalling")
        title = a.statusText
          ? `Cold Call — ${a.statusText}`
          : "Cold Call Logged";
      else if (a.sourceTab === "leads" || a.sourceTab === "yetToHappen")
        title = a.statusText
          ? `Meeting — ${a.statusText}`
          : "Meeting Scheduled";
      else if (a.sourceTab === "callBackSendInfo")
        title = "Callback / Send Info Logged";
      else if (a.sourceTab === "notInterested") title = "Marked Not Interested";
      else if (a.sourceTab === "keepInTouch") title = "Keep in Touch Follow-up";
      else if (a.sourceTab === "whatsapp") title = "WhatsApp Follow-up";
      else if (a.sourceTab === "linkedin") title = "LinkedIn Interaction";

      events.push({
        id: `activity_${a.id}`,
        date: a.entryDate,
        title,
        description: a.comments || a.statusText,
        icon: "source",
        sourceRoute: `${meta.route}?row=${a.sourceRowId}`,
      });
    });

    notes.forEach((n) => {
      events.push({
        id: `note_${n.id}`,
        date: new Date(n.createdAt),
        title: `Note added by ${n.createdBy}`,
        description: n.content,
        icon: "note",
      });
    });

    companyAuditLogs.forEach((l) => {
      events.push({
        id: `audit_${l.id}`,
        date: new Date(l.at),
        title: l.details,
        icon: l.action === "temperature_changed" ? "temp" : "priority",
      });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [profile, notes, companyAuditLogs]);

  const groupedTimeline = useMemo(() => {
    const groups: { label: string; items: TimelineEvent[] }[] = [];
    timeline.forEach((ev) => {
      const label = relativeDayLabel(ev.date);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(ev);
      else groups.push({ label, items: [ev] });
    });
    return groups;
  }, [timeline]);

  const handleAddNote = async () => {
    if (!noteDraft.trim() || !profile) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      await addCrmNote(companyKey, profile.companyName, noteDraft, currentUser);
      setNoteDraft("");
    } catch (err) {
      console.error("Failed to add CRM note:", err);
      setNoteError("Failed to save note — please try again.");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Loading company profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl">
        <EmptyState
          icon={Building2}
          title="Company not found"
          description="This record may have been removed from its source tab."
        />
        <div className="text-center pb-6">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => navigate("/crm/search")}
          >
            Back to Search
          </Button>
        </div>
      </div>
    );
  }

  const uniqueContacts = profile.contacts.filter(
    (c, i, arr) =>
      arr.findIndex((x) => x.name === c.name && x.email === c.email) === i,
  );

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {profile.companyName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <PriorityBadge priority={metadata?.priority} />
                <TemperatureBadge temperature={metadata?.temperature} />
                {profile.domains.map((d) => (
                  <span
                    key={d}
                    className="text-sm text-slate-400 flex items-center gap-1"
                  >
                    <Globe2 className="h-3 w-3" /> {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Priority / Temperature quick-set — Feature 6, isolated metadata layer */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">
                Priority
              </p>
              <div className="flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setCrmPriority(
                        companyKey,
                        profile.companyName,
                        p,
                        currentUser,
                      )
                    }
                    className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${
                      metadata?.priority === p
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-500 border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">
                Temperature
              </p>
              <div className="flex gap-1">
                {TEMPERATURES.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setCrmTemperature(
                        companyKey,
                        profile.companyName,
                        t,
                        currentUser,
                      )
                    }
                    className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${
                      metadata?.temperature === t
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-500 border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {metadata?.updatedBy && (
          <p className="text-sm text-slate-400 mt-3">
            Classification last updated by {metadata.updatedBy} ·{" "}
            {metadata.updatedAt
              ? formatShortDate(new Date(metadata.updatedAt))
              : ""}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* CRM Status */}
          <SectionCard icon={ListChecks} title="CRM Status" tone="blue">
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Last Activity
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {profile.lastActivity
                    ? TAB_META[profile.lastActivity.sourceTab].label
                    : "—"}
                </p>
                <p className="text-sm text-slate-500">
                  {formatShortDate(profile.lastActivity?.entryDate)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Next Follow-up
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {profile.nextFollowUp?.prospectName ||
                    (profile.nextFollowUp ? "Scheduled" : "—")}
                </p>
                <p className="text-sm text-slate-500">
                  {formatShortDate(profile.nextFollowUp?.dueDate)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Upcoming Meeting
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {profile.nextMeeting?.prospectName ||
                    (profile.nextMeeting ? "Scheduled" : "—")}
                </p>
                <p className="text-sm text-slate-500">
                  {formatShortDate(profile.nextMeeting?.dueDate)}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Contact Details */}
          <SectionCard
            icon={User}
            title="Contact Details"
            tone="brand"
            description={`${uniqueContacts.length} contact(s) on file`}
          >
            {uniqueContacts.length === 0 ? (
              <EmptyState icon={User} title="No contacts recorded yet" />
            ) : (
              <div className="divide-y divide-slate-100">
                {uniqueContacts.map((c, i) => (
                  <div
                    key={`${c.name}_${i}`}
                    className="p-4 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {c.name}
                      </p>
                      {c.title && (
                        <p className="text-sm text-slate-500">{c.title}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {c.email && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                      {c.contactNumber && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Phone className="h-3 w-3" /> {c.contactNumber}
                        </span>
                      )}
                      <SourceTag sourceTab={c.sourceTab} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Activity Timeline — Feature 5 */}
          <SectionCard
            icon={CalendarClock}
            title="Activity Timeline"
            tone="amber"
            description="Chronological history, most recent first"
          >
            {groupedTimeline.length === 0 ? (
              <EmptyState icon={Clock3} title="No activity recorded yet" />
            ) : (
              <div className="p-4 space-y-5 max-h-[520px] overflow-y-auto">
                {groupedTimeline.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                      {group.label}
                    </p>
                    <div className="space-y-2.5 border-l-2 border-slate-100 pl-4">
                      {group.items.map((ev) => (
                        <div key={ev.id} className="relative">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-white" />
                          <button
                            type="button"
                            disabled={!ev.sourceRoute}
                            onClick={() =>
                              ev.sourceRoute && navigate(ev.sourceRoute)
                            }
                            className={`text-left ${ev.sourceRoute ? "hover:underline cursor-pointer" : "cursor-default"}`}
                          >
                            <p className="text-sm font-semibold text-slate-800">
                              {ev.title}
                            </p>
                          </button>
                          {ev.description && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          {/* Company Details */}
          <SectionCard icon={Building2} title="Company Details" tone="slate">
            <div className="p-4 space-y-2 text-sm">
              <p className="flex justify-between">
                <span className="text-slate-400">Company</span>
                <span className="font-semibold text-slate-800">
                  {profile.companyName}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">Domain(s)</span>
                <span className="font-semibold text-slate-800">
                  {profile.domains.join(", ") || "—"}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">Sources</span>
                <span className="font-semibold text-slate-800">
                  {profile.tabsPresent.length}
                </span>
              </p>
            </div>
          </SectionCard>

          {/* Activity Summary */}
          <SectionCard icon={Flame} title="Activity Summary" tone="red">
            <div className="p-4 grid grid-cols-2 gap-2.5">
              {profile.tabsPresent.map((tab) => {
                const meta = TAB_META[tab];
                const Icon = meta.icon;
                const count = profile.activities.filter(
                  (a) => a.sourceTab === tab,
                ).length;
                return (
                  <div
                    key={tab}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5"
                  >
                    <Icon className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-none">
                        {count}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {meta.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Notes — Feature 7 */}
          <SectionCard
            icon={StickyNote}
            title="Notes"
            tone="amber"
            description={`${notes.length} note(s)`}
          >
            <div className="p-4 space-y-3">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note about this company…"
                className="text-sm rounded-xl"
                rows={3}
              />
              <Button
                size="sm"
                className="rounded-xl gap-1.5 w-full"
                disabled={!noteDraft.trim() || savingNote}
                onClick={handleAddNote}
              >
                <Plus className="h-3.5 w-3.5" /> Add Note
              </Button>
              {noteError && <p className="text-sm text-red-600">{noteError}</p>}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pt-1">
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No notes yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {n.content}
                      </p>
                      <p className="text-sm text-slate-400 mt-1.5 flex items-center gap-1">
                        <Send className="h-2.5 w-2.5" /> {n.createdBy} ·{" "}
                        {formatShortDate(new Date(n.createdAt))}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
