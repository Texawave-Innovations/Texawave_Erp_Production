// CRM-only notification generation + persistence.
// Reads exclusively from `crm/*` source tabs (never modifies them) and reads/writes exclusively
// under `crm/notifications/feed` — completely isolated from the app's global `notifications/*`
// Firebase path and from `services/notifications.ts` / `components/NotificationBell.tsx`.

import { ref, onValue, update, remove } from "firebase/database";
import { database } from "@/services/firebase";
import { User } from "@/types";
import { assertCrmAdmin } from "../domain/recycleBinService";
import {
  CallBackSendInfoSheetData,
  KeepInTouchSheetData,
  LeadsSheetData,
  LinkedInSheetData,
  WhatsAppSheetData,
  YetToHappenSheetData,
} from "../types";
import {
  CrmDeletedNotification,
  CrmNotification,
  CrmNotificationFeed,
  CrmNotificationPriority,
  CrmNotificationRecycleBin,
  CrmNotificationSourceTab,
  CrmNotificationStatus,
  CrmNotificationType,
} from "./types";
import {
  diffInDays,
  extractLooseTime,
  looksClosedOut,
  parseLooseDate,
  toISO,
} from "./dateUtils";

export const CRM_NOTIFICATIONS_FEED_PATH = "crm/notifications/feed";
export const CRM_NOTIFICATIONS_RECYCLE_PATH = "crm/notifications/recycleBin";

// ---------------------------------------------------------------------------
// Feed subscription + actions (Phase 5 — action-based workflow)
// ---------------------------------------------------------------------------

export function subscribeToCrmNotifications(
  callback: (feed: CrmNotificationFeed) => void,
): () => void {
  const feedRef = ref(database, CRM_NOTIFICATIONS_FEED_PATH);
  const unsubscribe = onValue(feedRef, (snap) => {
    callback(snap.val() || {});
  });
  return () => unsubscribe();
}

export async function acknowledgeCrmNotification(id: string): Promise<void> {
  await update(ref(database, `${CRM_NOTIFICATIONS_FEED_PATH}/${id}`), {
    status: "Acknowledged" as CrmNotificationStatus,
    acknowledgedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function markCrmNotificationDone(id: string): Promise<void> {
  await update(ref(database, `${CRM_NOTIFICATIONS_FEED_PATH}/${id}`), {
    status: "Done" as CrmNotificationStatus,
    completedAt: Date.now(),
    updatedAt: Date.now(),
    snoozeUntil: null,
  });
}

export async function snoozeCrmNotification(
  id: string,
  until: number,
): Promise<void> {
  await update(ref(database, `${CRM_NOTIFICATIONS_FEED_PATH}/${id}`), {
    status: "Snoozed" as CrmNotificationStatus,
    snoozeUntil: until,
    updatedAt: Date.now(),
  });
}

export async function markCrmNotificationRead(id: string): Promise<void> {
  await update(ref(database, `${CRM_NOTIFICATIONS_FEED_PATH}/${id}`), {
    isRead: true,
  });
}

// ---------------------------------------------------------------------------
// Recycle Bin — a completed notification removed from the active feed is moved here rather than
// deleted outright, so it can be restored or, only on an explicit confirmed action, purged for
// good. Never touches the underlying CRM record (lead/deal/meeting/etc.) it was generated from.
// ---------------------------------------------------------------------------

export function subscribeToCrmRecycleBin(
  callback: (bin: CrmNotificationRecycleBin) => void,
): () => void {
  const binRef = ref(database, CRM_NOTIFICATIONS_RECYCLE_PATH);
  const unsubscribe = onValue(binRef, (snap) => {
    callback(snap.val() || {});
  });
  return () => unsubscribe();
}

/** Moves a notification out of the active feed and into the Recycle Bin. */
export async function deleteCrmNotification(
  notification: CrmNotification,
  deletedBy?: string,
): Promise<void> {
  const deleted: CrmDeletedNotification = {
    ...notification,
    deletedAt: Date.now(),
    deletedBy,
  };
  await update(ref(database), {
    [`${CRM_NOTIFICATIONS_FEED_PATH}/${notification.id}`]: null,
    [`${CRM_NOTIFICATIONS_RECYCLE_PATH}/${notification.id}`]: deleted,
  });
}

/** Restores a Recycle Bin notification back into the active feed, preserving its prior status. */
export async function restoreCrmNotification(
  deleted: CrmDeletedNotification,
): Promise<void> {
  const { deletedAt: _deletedAt, deletedBy: _deletedBy, ...restored } = deleted;
  await update(ref(database), {
    [`${CRM_NOTIFICATIONS_RECYCLE_PATH}/${deleted.id}`]: null,
    [`${CRM_NOTIFICATIONS_FEED_PATH}/${deleted.id}`]: {
      ...restored,
      updatedAt: Date.now(),
    },
  });
}

/** Permanently removes a notification from the Recycle Bin. Irreversible — call only after
 *  explicit user confirmation. Admin-only: rejects (throws) for any non-admin caller, the same
 *  as every other permanent-delete in the CRM Recycle Bin. */
export async function permanentlyDeleteCrmNotification(
  id: string,
  user: User | null | undefined,
): Promise<void> {
  assertCrmAdmin(user);
  await remove(ref(database, `${CRM_NOTIFICATIONS_RECYCLE_PATH}/${id}`));
}

// ---------------------------------------------------------------------------
// Generation (Phase 3 & 4 — data model + follow-up/meeting reminder logic)
// ---------------------------------------------------------------------------

interface Candidate {
  key: string;
  sourceTab: CrmNotificationSourceTab;
  sourceRowId: string;
  sourceDueRaw: string;
  relatedTabLabel: string;
  type: CrmNotificationType;
  title: string;
  description: string;
  companyName?: string;
  prospectName?: string;
  dueDate: string;
  dueTime?: string;
  priority: CrmNotificationPriority;
  diffDays: number;
}

function makeKey(
  sourceTab: CrmNotificationSourceTab,
  sourceRowId: string,
  kind: string,
): string {
  return `${sourceTab}_${sourceRowId}_${kind}`;
}

function meetingCandidate(
  sourceTab: "yetToHappen" | "leads",
  relatedTabLabel: string,
  rowId: string,
  row: {
    companyName?: string;
    prospectName?: string;
    meetingStatus?: string;
    date?: string;
    meetingScheduled?: string;
  },
): Candidate | null {
  if (looksClosedOut(row.meetingStatus)) return null;
  const due = parseLooseDate(row.date);
  if (!due) return null;
  const diffDays = diffInDays(due);
  if (diffDays > 1) return null; // only tomorrow / today / overdue are tracked

  const company = row.companyName || "Unknown Company";
  const time =
    extractLooseTime(row.meetingScheduled) || extractLooseTime(row.date);
  const timeStr = time ? ` at ${time}` : "";
  const kind =
    diffDays === 1
      ? "meeting-tomorrow"
      : diffDays === 0
        ? "meeting-today"
        : "meeting-overdue";
  const title =
    diffDays === 1
      ? `Meeting Reminder — ${company} has a meeting tomorrow${timeStr}`
      : diffDays === 0
        ? `Meeting Today — ${company}${timeStr}`
        : `Meeting Overdue — ${company}'s meeting has passed`;

  return {
    key: makeKey(sourceTab, rowId, kind),
    sourceTab,
    sourceRowId: rowId,
    sourceDueRaw: row.date || "",
    relatedTabLabel,
    type: kind as CrmNotificationType,
    title,
    description: `${row.prospectName ? row.prospectName + " · " : ""}Scheduled: ${row.meetingScheduled || row.date}`,
    companyName: row.companyName,
    prospectName: row.prospectName,
    dueDate: toISO(due),
    dueTime: time,
    priority: "high",
    diffDays,
  };
}

function followUpCandidate(
  sourceTab: CrmNotificationSourceTab,
  relatedTabLabel: string,
  rowId: string,
  row: { companyName?: string; prospectName?: string },
  dueRaw: string | undefined,
  labelPrefix: string,
  kindDue: CrmNotificationType,
  kindOverdue: CrmNotificationType,
): Candidate | null {
  const due = parseLooseDate(dueRaw);
  if (!due) return null;
  const diffDays = diffInDays(due);
  if (diffDays > 1) return null; // only start tracking once due today/tomorrow/overdue

  const company = row.companyName || "Unknown Company";
  const isOverdue = diffDays < 0;
  const kind = isOverdue ? kindOverdue : kindDue;
  const title = isOverdue
    ? `${labelPrefix} Overdue — ${company}`
    : `${labelPrefix} Due Today — ${company}`;

  return {
    key: makeKey(sourceTab, rowId, kind),
    sourceTab,
    sourceRowId: rowId,
    sourceDueRaw: dueRaw || "",
    relatedTabLabel,
    type: kind,
    title,
    description: `Follow up with ${row.prospectName || company}. Next follow-up: ${dueRaw}`,
    companyName: row.companyName,
    prospectName: row.prospectName,
    dueDate: toISO(due),
    priority: isOverdue ? "high" : "medium",
    diffDays,
  };
}

export interface CrmSourceSnapshots {
  yetToHappen: YetToHappenSheetData;
  leads: LeadsSheetData;
  callBackSendInfo: CallBackSendInfoSheetData;
  keepInTouch: KeepInTouchSheetData;
  whatsapp: WhatsAppSheetData;
  linkedin: LinkedInSheetData;
}

function collectCandidates(sources: CrmSourceSnapshots): Candidate[] {
  const out: Candidate[] = [];

  Object.entries(sources.yetToHappen || {}).forEach(([id, row]) => {
    const c = meetingCandidate("yetToHappen", "Yet to Happen", id, row);
    if (c) out.push(c);
  });
  Object.entries(sources.leads || {}).forEach(([id, row]) => {
    const c = meetingCandidate("leads", "Leads", id, row);
    if (c) out.push(c);
  });
  Object.entries(sources.callBackSendInfo || {}).forEach(([id, row]) => {
    const c = followUpCandidate(
      "callBackSendInfo",
      "Call Back-Send Info",
      id,
      row,
      row.nextFollowUp,
      "Callback",
      "callback-due",
      "callback-overdue",
    );
    if (c) out.push(c);
  });
  Object.entries(sources.keepInTouch || {}).forEach(([id, row]) => {
    const c = followUpCandidate(
      "keepInTouch",
      "Keep in Touch",
      id,
      row,
      row.nextFollowUp,
      "Keep in Touch",
      "keepintouch-due",
      "keepintouch-overdue",
    );
    if (c) out.push(c);
  });
  Object.entries(sources.whatsapp || {}).forEach(([id, row]) => {
    const c = followUpCandidate(
      "whatsapp",
      "WhatsApp",
      id,
      row,
      row.followUpDate,
      "WhatsApp Follow-up",
      "whatsapp-followup",
      "whatsapp-followup-overdue",
    );
    if (c) out.push(c);
  });
  Object.entries(sources.linkedin || {}).forEach(([id, row]) => {
    const c = followUpCandidate(
      "linkedin",
      "LinkedIn",
      id,
      row,
      row.followUpDate,
      "LinkedIn Follow-up",
      "linkedin-followup",
      "linkedin-followup-overdue",
    );
    if (c) out.push(c);
  });

  return out;
}

/**
 * Diffs freshly-scanned candidates against the current feed and returns a single batched
 * Firebase multi-path update. Never deletes existing notifications and never overwrites a
 * user-owned action state (Acknowledged/Done/Snoozed) unless the underlying row's due-date
 * text actually changed. Called from `useCrmNotificationGenerator` — safe to call repeatedly
 * (idempotent, deterministic keys) so multiple open CRM tabs never create duplicates.
 */
export function buildNotificationSyncUpdates(
  sources: CrmSourceSnapshots,
  currentFeed: CrmNotificationFeed,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const now = Date.now();
  const candidates = collectCandidates(sources);

  for (const c of candidates) {
    const existing = currentFeed[c.key];
    const base = `${CRM_NOTIFICATIONS_FEED_PATH}/${c.key}`;

    if (!existing) {
      const notif: CrmNotification = {
        id: c.key,
        sourceTab: c.sourceTab,
        sourceRowId: c.sourceRowId,
        sourceDueRaw: c.sourceDueRaw,
        relatedTabLabel: c.relatedTabLabel,
        type: c.type,
        title: c.title,
        description: c.description,
        // Same `undefined`-rejection concern as `dueTime` below — company/prospect name are
        // optional on several source sheet rows.
        companyName: c.companyName ?? null,
        prospectName: c.prospectName ?? null,
        dueDate: c.dueDate,
        // Firebase `update()` rejects `undefined` outright — `extractLooseTime` legitimately
        // returns undefined when neither source field has a parseable time, so that must become
        // RTDB's own "no value" idiom (`null`) here rather than reach the write as `undefined`.
        dueTime: c.dueTime ?? null,
        createdAt: now,
        updatedAt: now,
        status: c.diffDays < 0 ? "Overdue" : "Pending",
        priority: c.priority,
      };
      updates[base] = notif;
      continue;
    }

    if (existing.sourceDueRaw !== c.sourceDueRaw) {
      // The underlying row's due-date field was edited — treat as a fresh instance.
      updates[base] = {
        ...existing,
        sourceDueRaw: c.sourceDueRaw,
        title: c.title,
        description: c.description,
        dueDate: c.dueDate,
        dueTime: c.dueTime ?? null,
        priority: c.priority,
        status: c.diffDays < 0 ? "Overdue" : "Pending",
        updatedAt: now,
        acknowledgedAt: null,
        completedAt: null,
        snoozeUntil: null,
        isRead: false,
      };
      continue;
    }

    // Unchanged row — only auto-manage transitions the user doesn't own.
    if (existing.status === "Done") continue;

    if (existing.status === "Snoozed") {
      if (existing.snoozeUntil && now >= existing.snoozeUntil) {
        updates[`${base}/status`] = c.diffDays < 0 ? "Overdue" : "Pending";
        updates[`${base}/snoozeUntil`] = null;
        updates[`${base}/updatedAt`] = now;
      }
      continue;
    }

    if (
      (existing.status === "Pending" || existing.status === "Acknowledged") &&
      c.diffDays < 0
    ) {
      updates[`${base}/status`] = "Overdue";
      updates[`${base}/title`] = c.title;
      updates[`${base}/description`] = c.description;
      updates[`${base}/priority`] = "high";
      updates[`${base}/updatedAt`] = now;
    }
  }

  return updates;
}

export async function syncCrmNotifications(
  sources: CrmSourceSnapshots,
  currentFeed: CrmNotificationFeed,
): Promise<void> {
  const updates = buildNotificationSyncUpdates(sources, currentFeed);
  if (Object.keys(updates).length === 0) return;
  await update(ref(database), updates);
}
