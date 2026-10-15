// Shared subscription to `crm/notifications/feed` — CrmActionPanel, CrmNotificationBell, and the
// two notification generator hooks (useCrmNotificationGenerator, useCrmDomainNotificationGenerator)
// all need the live feed, and previously each opened its own independent `onValue` listener on the
// exact same path. Every write to that path (an Acknowledge/Done/Snooze, or either generator
// syncing a new notification in) fired 4 separate callbacks, each deserializing and re-rendering
// its own copy of identical data. Mounted once in `CRMLayout.tsx`; every consumer below reads the
// one shared subscription instead.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeToCrmNotifications } from "./crmNotificationService";
import { CrmNotificationFeed } from "./types";

const CrmNotificationFeedContext = createContext<CrmNotificationFeed | null>(
  null,
);

export function CrmNotificationFeedProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [feed, setFeed] = useState<CrmNotificationFeed>({});
  useEffect(() => subscribeToCrmNotifications(setFeed), []);
  return (
    <CrmNotificationFeedContext.Provider value={feed}>
      {children}
    </CrmNotificationFeedContext.Provider>
  );
}

export function useCrmNotificationFeed(): CrmNotificationFeed {
  const ctx = useContext(CrmNotificationFeedContext);
  if (!ctx)
    throw new Error(
      "useCrmNotificationFeed must be used within a CrmNotificationFeedProvider (mounted in CRMLayout.tsx)",
    );
  return ctx;
}
