"use client";

import type { Account } from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQueries } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { Flame, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { getStageHistory } from "@/features/crm/opportunities/api";
import { useAccountTimelineEvents } from "../../hooks";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import { useDeleteActivity } from "@/features/crm/activities/hooks";
import { useDeleteContact } from "@/features/crm/contacts/hooks";
import { useDeleteFollowUp } from "@/features/crm/follow-ups/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
  formatMoney,
} from "@/features/crm/legacy-ui/CrmCommon";
import { useDeleteMeeting } from "@/features/crm/meetings/hooks";
import { useDeleteCrmNote } from "@/features/crm/notes/hooks";
import { useDeleteQuotation } from "@/features/crm/quotations/hooks";
import { usePermission } from "@/hooks/usePermission";
import type { AccountRelated } from "../../useAccountRelated";
import { CRM_DELETE_BTN_CLASS, formatRupees } from "../accountUi";

type DeletePerm =
  "contact" | "activity" | "meeting" | "followup" | "quotation" | "note";

interface TimelineItem {
  id: string;
  date: number;
  title: string;
  description?: string | null | undefined;
  /** Present only for items backed by a real delete flow (same soft-delete as the record's tab). */
  deleteAction?: {
    perm: DeletePerm;
    confirmTitle: string;
    confirmDescription: string;
    onConfirm: () => Promise<void>;
  };
}

function relativeDayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "dd MMM yyyy");
}

const ts = (s: string) => new Date(s).getTime();

export function TimelineTab({
  account,
  related,
}: {
  account: Account;
  related: AccountRelated;
}) {
  const canDelete: Record<DeletePerm, boolean> = {
    contact: usePermission([
      "crm.contact.write.own",
      "crm.contact.write.team",
      "crm.contact.write.all",
    ]),
    activity: usePermission("crm.activity.delete"),
    meeting: usePermission("crm.meeting.delete"),
    followup: usePermission("crm.followup.delete"),
    quotation: usePermission("crm.quotation.delete"),
    note: usePermission("crm.note.delete"),
  };
  const delContact = useDeleteContact();
  const delActivity = useDeleteActivity();
  const delMeeting = useDeleteMeeting();
  const delFollowUp = useDeleteFollowUp();
  const delQuotation = useDeleteQuotation();
  const delNote = useDeleteCrmNote();
  const organizationId = useAuthStore((s) => s.organizationId);
  const eventsQuery = useAccountTimelineEvents(account.id);
  const auditEvents = eventsQuery.data;
  // Same query key as `useStageHistory`, one per deal of the account.
  const stageQueries = useQueries({
    queries: related.opportunities.map((o) => ({
      queryKey: orgScopedKey(
        organizationId ?? 0,
        "crm-opportunity-stage-history",
        o.id,
      ),
      queryFn: () => getStageHistory(o.id),
      enabled: Boolean(organizationId),
    })),
  });
  const stageHistory = stageQueries.flatMap((q) => q.data ?? []);

  const groups = useMemo(() => {
    const items: TimelineItem[] = [
      {
        id: `account_${account.id}`,
        date: ts(account.createdAt),
        title: "Account Created",
        description: account.name,
      },
    ];
    related.contacts.forEach((c) =>
      items.push({
        id: `contact_${c.id}`,
        date: ts(c.createdAt),
        title: `Contact Added — ${c.name}`,
        description: c.designation,
        deleteAction: {
          perm: "contact",
          confirmTitle: "Delete this contact?",
          confirmDescription: `"${c.name}" will be moved to the CRM Recycle Bin.`,
          onConfirm: async () => {
            await delContact.mutateAsync(c.id);
          },
        },
      }),
    );
    related.opportunities.forEach((o) =>
      items.push({
        id: `opp_${o.id}`,
        date: ts(o.createdAt),
        title: `Opportunity Created — ${o.title}`,
        description: `${o.stage.label} · ${formatRupees(o.estimatedValue)}`,
      }),
    );
    stageHistory.forEach((h) =>
      items.push({
        id: `stage_${h.id}`,
        date: ts(h.changedAt),
        title: h.fromStage
          ? `Stage: ${h.fromStage.label} → ${h.toStage.label}`
          : `Stage set to ${h.toStage.label}`,
        description: h.remarks
          ? `${h.remarks}${h.changedByName ? ` · ${h.changedByName}` : ""}`
          : h.changedByName,
      }),
    );
    related.activities.forEach((a) =>
      items.push({
        id: `activity_${a.id}`,
        date: ts(a.occurredAt),
        title: `${a.type} — ${a.subject}`,
        description: a.notes,
        deleteAction: {
          perm: "activity",
          confirmTitle: "Delete this activity?",
          confirmDescription:
            "This logged activity will be moved to the CRM Recycle Bin.",
          onConfirm: async () => {
            await delActivity.mutateAsync(a.id);
          },
        },
      }),
    );
    related.meetings.forEach((m) =>
      items.push({
        id: `meeting_${m.id}`,
        date: ts(m.createdAt),
        title: `Meeting (${m.mode}) — ${m.status}`,
        description: m.agenda,
        deleteAction: {
          perm: "meeting",
          confirmTitle: "Delete this meeting?",
          confirmDescription:
            "This meeting and its recorded outcome will be moved to the CRM Recycle Bin.",
          onConfirm: async () => {
            await delMeeting.mutateAsync(m.id);
          },
        },
      }),
    );
    related.followUps.forEach((f) =>
      items.push({
        id: `followup_${f.id}`,
        date: ts(f.createdAt),
        title: `Follow-up (${f.type}) — ${f.effectiveStatus}`,
        description: f.notes,
        deleteAction: {
          perm: "followup",
          confirmTitle: "Delete this follow-up?",
          confirmDescription:
            "This follow-up and its reschedule history will be moved to the CRM Recycle Bin.",
          onConfirm: async () => {
            await delFollowUp.mutateAsync(f.id);
          },
        },
      }),
    );
    related.quotations.forEach((q) =>
      items.push({
        id: `quote_${q.id}`,
        date: ts(q.createdAt),
        title: `Quotation ${q.quotationNumber} — ${q.status}`,
        description: formatMoney(Number(q.grandTotal), q.currency),
        deleteAction: {
          perm: "quotation",
          confirmTitle: "Delete this quotation?",
          confirmDescription: `Quotation ${q.quotationNumber} will be moved to the CRM Recycle Bin.`,
          onConfirm: async () => {
            await delQuotation.mutateAsync(q.id);
          },
        },
      }),
    );
    related.notes.forEach((n) =>
      items.push({
        id: `note_${n.id}`,
        date: ts(n.createdAt),
        title: n.createdByName ? `Note by ${n.createdByName}` : "Note",
        description: n.content,
        deleteAction: {
          perm: "note",
          confirmTitle: "Delete this note?",
          confirmDescription: "This note will be moved to the CRM Recycle Bin.",
          onConfirm: async () => {
            await delNote.mutateAsync(n.id);
          },
        },
      }),
    );
    related.products.forEach(({ item, opportunity }) =>
      items.push({
        id: `product_${item.id}`,
        date: ts(item.createdAt),
        title: `Product Added — ${item.productName}`,
        description: `Qty ${Number(item.quantity)} · ${opportunity.title}`,
      }),
    );

    (auditEvents ?? []).forEach((l) =>
      items.push({
        id: `audit_${l.id}`,
        date: ts(l.at),
        title: `${l.action.replace(/_/g, " ")}${l.byName ? ` — ${l.byName}` : ""}`,
        description: l.details,
      }),
    );

    items.sort((a, b) => b.date - a.date);
    const out: { label: string; items: TimelineItem[] }[] = [];
    items.forEach((item) => {
      const label = relativeDayLabel(new Date(item.date));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    });
    return out;
    // Mutation hooks return stable objects; deliberately not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutateAsync handles are stable
  }, [account, related, stageHistory.length, auditEvents]);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
      {groups.length === 0 ? (
        <EmptyState icon={Flame} title="Nothing recorded yet" />
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map((group) => (
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
                    {item.deleteAction && canDelete[item.deleteAction.perm] && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(CRM_DELETE_BTN_CLASS, "shrink-0")}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        }
                        title={item.deleteAction.confirmTitle}
                        description={item.deleteAction.confirmDescription}
                        onConfirm={item.deleteAction.onConfirm}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
