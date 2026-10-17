// Mounted once (in CRMLayout.tsx, alongside the existing `useCrmNotificationGenerator`) to keep
// `crm/notifications/feed` in sync with the CRM Core Domain collections (meetings, follow-ups,
// opportunities, quotations). Read-only against those collections — never writes back to them.
// Idempotent, same as the legacy generator: safe to run from multiple open CRM sessions at once.
import { useEffect, useRef } from "react";
import { useCrmDomainData } from "./useCrmDomainData";
import { syncDomainNotifications } from "./domainNotificationService";
import { useCrmPipelineStages } from "./pipelineStagesService";
import { resolveAccountId } from "./relatedLookup";
import { useCrmNotificationFeed } from "../notifications/notificationFeedContext";
import {
  CrmAccount,
  CrmContact,
  CrmFollowUp,
  CrmMeeting,
  CrmOpportunity,
  CrmQuotation,
} from "./types";

const DEBOUNCE_MS = 400;
const RESCAN_INTERVAL_MS = 60_000;

export function useCrmDomainNotificationGenerator(): void {
  const {
    accounts,
    contacts,
    meetings,
    followUps,
    opportunities,
    quotations,
    loading,
  } = useCrmDomainData();
  const { stages: pipelineStages } = useCrmPipelineStages();
  // The live feed comes from the one shared `crm/notifications/feed` subscription instead of this
  // hook opening a second independent listener on the exact same path.
  const feed = useCrmNotificationFeed();
  const feedRef = useRef(feed);
  const dataRef = useRef<{
    accounts: CrmAccount[];
    contacts: CrmContact[];
    meetings: CrmMeeting[];
    followUps: CrmFollowUp[];
    opportunities: CrmOpportunity[];
    quotations: CrmQuotation[];
  }>({
    accounts: [],
    contacts: [],
    meetings: [],
    followUps: [],
    opportunities: [],
    quotations: [],
  });
  const stagesRef = useRef(pipelineStages);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = {
    accounts,
    contacts,
    meetings,
    followUps,
    opportunities,
    quotations,
  };
  stagesRef.current = pipelineStages;
  feedRef.current = feed;

  const runSync = () => {
    const {
      accounts: a,
      contacts: ct,
      meetings: m,
      followUps: f,
      opportunities: o,
      quotations: q,
    } = dataRef.current;
    const accountName = (id: string) =>
      a.find((acc) => acc.id === id)?.name || "Unknown Account";
    const resolveAccountIdFor = (
      relatedType: Parameters<typeof resolveAccountId>[0],
      relatedId: string,
    ) => resolveAccountId(relatedType, relatedId, ct, o);
    const slaFor = (stageId: string) =>
      stagesRef.current.find((s) => s.id === stageId)?.slaDays;
    syncDomainNotifications(
      {
        meetings: m,
        followUps: f,
        opportunities: o,
        quotations: q,
        accountName,
        resolveAccountId: resolveAccountIdFor,
        slaFor,
      },
      feedRef.current,
    ).catch((err) =>
      console.error("CRM domain notification sync failed:", err),
    );
  };

  useEffect(() => {
    if (loading) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSync, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    accounts,
    contacts,
    meetings,
    followUps,
    opportunities,
    quotations,
    loading,
  ]);

  useEffect(() => {
    const interval = setInterval(runSync, RESCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}
