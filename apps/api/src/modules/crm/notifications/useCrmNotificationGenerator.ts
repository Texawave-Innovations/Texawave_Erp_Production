// Mounted once (in CRMLayout.tsx) to keep `crm/notifications/feed` in sync with the 6 CRM
// source tabs that carry due-date-like fields. Read-only against the source tabs — never
// writes anything back to them. Idempotent: safe to run from multiple open CRM sessions at
// once without creating duplicate notifications (see crmNotificationService.ts).
import { useCallback, useEffect, useRef } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "@/services/firebase";
import {
  CallBackSendInfoSheetData,
  KeepInTouchSheetData,
  LeadsSheetData,
  LinkedInSheetData,
  WhatsAppSheetData,
  YetToHappenSheetData,
} from "../types";
import { CrmNotificationFeed } from "./types";
import {
  CrmSourceSnapshots,
  syncCrmNotifications,
} from "./crmNotificationService";
import { useCrmNotificationFeed } from "./notificationFeedContext";

const SOURCE_PATHS: Record<keyof CrmSourceSnapshots, string> = {
  yetToHappen: "crm/yetToHappen",
  leads: "crm/leads",
  callBackSendInfo: "crm/callBackSendInfo",
  keepInTouch: "crm/keepInTouch",
  whatsapp: "crm/whatsapp",
  linkedin: "crm/linkedin",
};

const RESCAN_INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 400;

const EMPTY_SOURCES: CrmSourceSnapshots = {
  yetToHappen: {} as YetToHappenSheetData,
  leads: {} as LeadsSheetData,
  callBackSendInfo: {} as CallBackSendInfoSheetData,
  keepInTouch: {} as KeepInTouchSheetData,
  whatsapp: {} as WhatsAppSheetData,
  linkedin: {} as LinkedInSheetData,
};

export function useCrmNotificationGenerator(): void {
  // The live feed comes from the one shared `crm/notifications/feed` subscription (see
  // notificationFeedContext.tsx) instead of this hook opening a second independent listener on
  // the exact same path.
  const feed = useCrmNotificationFeed();
  const sourcesRef = useRef<CrmSourceSnapshots>({ ...EMPTY_SOURCES });
  const feedRef = useRef<CrmNotificationFeed>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which source tabs actually changed since the last sync — a single edited row in "leads"
  // otherwise re-scanned all 6 source tabs (proportional to total CRM data size) every time,
  // instead of just the one tab that changed.
  const dirtyKeysRef = useRef<Set<keyof CrmSourceSnapshots> | "all">("all");

  const runSync = useCallback((changedKey?: keyof CrmSourceSnapshots) => {
    if (dirtyKeysRef.current !== "all") {
      if (changedKey) dirtyKeysRef.current.add(changedKey);
      else dirtyKeysRef.current = "all"; // feed/interval triggers re-check every source's time-based transitions (overdue thresholds, snooze expiry), not just row edits
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const dirty = dirtyKeysRef.current;
      dirtyKeysRef.current = new Set<keyof CrmSourceSnapshots>();
      let scopedSources: CrmSourceSnapshots = sourcesRef.current;
      if (dirty !== "all") {
        scopedSources = { ...EMPTY_SOURCES };
        dirty.forEach((k) => {
          scopedSources[k] = sourcesRef.current[k];
        });
      }
      syncCrmNotifications(scopedSources, feedRef.current).catch((err) =>
        console.error("CRM notification sync failed:", err),
      );
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    feedRef.current = feed;
    runSync();
  }, [feed, runSync]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    (Object.keys(SOURCE_PATHS) as Array<keyof CrmSourceSnapshots>).forEach(
      (key) => {
        const sourceRef = ref(database, SOURCE_PATHS[key]);
        const unsubscribe = onValue(sourceRef, (snap) => {
          sourcesRef.current = {
            ...sourcesRef.current,
            [key]: snap.val() || {},
          };
          runSync(key);
        });
        unsubscribers.push(unsubscribe);
      },
    );

    const interval = setInterval(() => runSync(), RESCAN_INTERVAL_MS);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runSync]);
}
