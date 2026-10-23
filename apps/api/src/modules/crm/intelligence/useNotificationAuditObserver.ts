// Feature 8 — Audit Trail, notification actions.
//
// Read-only observer of the EXISTING CRM notification feed (`crm/notifications/feed`, owned by
// crmNotificationService.ts / CrmNotificationBell.tsx). It never modifies that feed and never
// touches the existing notification implementation — it only watches for status transitions
// (Acknowledged / Done / Snoozed) and records them under the new, isolated `crm/auditLogs` path.
//
// Note: because this observer runs client-side in every open CRM session (there is no backend
// function to attribute the action to the exact acting user), the audit entry is attributed to
// the current session's logged-in user. If multiple CRM users have the module open at once, the
// transition may be logged once per open session — an accepted limitation of a purely
// client-side, additive audit layer.
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { CrmNotificationFeed } from "../notifications/types";
import { useCrmNotificationFeed } from "../notifications/notificationFeedContext";
import { writeCrmAuditLog } from "./auditService";
import { slugifyCompanyKey } from "./shared";

export function useNotificationAuditObserver(): void {
  const { user } = useAuth();
  // Reads the ONE shared subscription (mounted in CRMLayout.tsx) instead of opening a second,
  // independent `onValue` listener on the exact same `crm/notifications/feed` path — which this
  // hook used to do, defeating the whole point of the shared-feed context every other consumer
  // (CrmActionPanel, CrmNotificationBell, the two notification generators) was moved onto.
  const feed = useCrmNotificationFeed();
  const prevRef = useRef<CrmNotificationFeed>({});
  const seededRef = useRef(false);
  const byRef = useRef(user?.name || user?.username || "CRM User");
  byRef.current = user?.name || user?.username || "CRM User";

  useEffect(() => {
    if (!seededRef.current) {
      // Establish a baseline on first snapshot — never backfill audit history for existing data.
      prevRef.current = feed;
      seededRef.current = true;
      return;
    }

    const prev = prevRef.current;
    const by = byRef.current;

    Object.entries(feed).forEach(([id, n]) => {
      const before = prev[id];
      if (!before || before.status === n.status) return;

      // CRM Core Domain notifications carry the real Account id — Company 360 profiles for
      // those accounts are keyed by that id, never by a slug of the display name, so a domain
      // notification's audit entry must use it directly or it can never surface on that
      // account's profile. Only legacy-sheet-sourced notifications (no domain Account) fall
      // back to slugifying `companyName`, matching how their own Company 360 profile is keyed.
      const companyKey =
        n.accountId ||
        (n.companyName ? slugifyCompanyKey(n.companyName, id) : undefined);

      if (n.status === "Acknowledged") {
        writeCrmAuditLog({
          companyKey,
          companyName: n.companyName,
          action: "notification_acknowledged",
          details: `Acknowledged: ${n.title}`,
          by,
          at: n.acknowledgedAt || Date.now(),
        }).catch((err) => console.error("CRM audit log failed:", err));
      } else if (n.status === "Done") {
        writeCrmAuditLog({
          companyKey,
          companyName: n.companyName,
          action: "notification_done",
          details: `Marked done: ${n.title}`,
          by,
          at: n.completedAt || Date.now(),
        }).catch((err) => console.error("CRM audit log failed:", err));
      } else if (n.status === "Snoozed") {
        writeCrmAuditLog({
          companyKey,
          companyName: n.companyName,
          action: "notification_snoozed",
          details: `Snoozed: ${n.title}`,
          by,
          at: Date.now(),
        }).catch((err) => console.error("CRM audit log failed:", err));
      }
    });

    prevRef.current = feed;
  }, [feed]);
}
