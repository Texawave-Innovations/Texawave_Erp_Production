// Read-only aggregation hook for the CRM Intelligence Layer (Dashboard, Search, Calendar,
// Company 360, Analytics). Subscribes to all 8 company-level CRM source tabs and never writes
// to any of them — mirrors the read pattern already used by useCrmNotificationGenerator.
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "@/services/firebase";
import { CrmSourceTabKey } from "./types";
import { CrmAllSources, EMPTY_CRM_SOURCES } from "./unify";
import { TAB_META, ALL_SOURCE_TABS } from "./tabMeta";

export function useCrmSourceData(): {
  sources: CrmAllSources;
  loading: boolean;
} {
  const [sources, setSources] = useState<CrmAllSources>(EMPTY_CRM_SOURCES);
  const [loadedTabs, setLoadedTabs] = useState<
    Partial<Record<CrmSourceTabKey, boolean>>
  >({});

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    ALL_SOURCE_TABS.forEach((key) => {
      const sourceRef = ref(database, TAB_META[key].firebasePath);
      const unsubscribe = onValue(sourceRef, (snap) => {
        setSources((prev) => ({ ...prev, [key]: snap.val() || {} }));
        setLoadedTabs((prev) => ({ ...prev, [key]: true }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const loading = ALL_SOURCE_TABS.some((key) => !loadedTabs[key]);
  return { sources, loading };
}
