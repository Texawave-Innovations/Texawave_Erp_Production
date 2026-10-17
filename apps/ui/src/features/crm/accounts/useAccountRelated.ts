"use client";

import type {
  Contact,
  CrmActivity,
  CrmDocument,
  CrmNote,
  CrmTask,
  FollowUp,
  Meeting,
  Opportunity,
  OpportunityProduct,
  Quotation,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQueries } from "@tanstack/react-query";
import { useActivities } from "@/features/crm/activities/hooks";
import { useContacts } from "@/features/crm/contacts/hooks";
import { useCrmDocuments } from "@/features/crm/documents/hooks";
import { useFollowUps } from "@/features/crm/follow-ups/hooks";
import { useMeetings } from "@/features/crm/meetings/hooks";
import { useCrmNotes } from "@/features/crm/notes/hooks";
import { listOpportunityProducts } from "@/features/crm/opportunities/api";
import { useOpportunities } from "@/features/crm/opportunities/hooks";
import { useQuotations } from "@/features/crm/quotations/hooks";
import { useCrmTasks } from "@/features/crm/tasks/hooks";
import { useAuthStore } from "@/stores/auth-store";

const LIMIT = 100;

/** Everything the Account 360 page shows, loaded once with the existing per-feature hooks so the
 * tab headings ("Contacts (3)"), Overview KPIs, Account Review and Timeline all read one set of
 * cached queries (the tabs' own mutations invalidate these same keys). Replaces legacy's
 * `useCrmDomainData()` + local filtering. */
export interface AccountRelated {
  loading: boolean;
  contacts: Contact[];
  opportunities: Opportunity[];
  meetings: Meeting[];
  followUps: FollowUp[];
  activities: CrmActivity[];
  tasks: CrmTask[];
  documents: CrmDocument[];
  notes: CrmNote[];
  quotations: Quotation[];
  /** Line items across every deal of the account, tagged with their deal. */
  products: { item: OpportunityProduct; opportunity: Opportunity }[];
}

export function useAccountRelated(accountId: number): AccountRelated {
  const organizationId = useAuthStore((s) => s.organizationId);
  const contacts = useContacts({ accountId, limit: LIMIT });
  const opportunities = useOpportunities({ accountId, limit: LIMIT });
  // Roll-up (legacy `relevantIds`): the account's own records plus those of its contacts and
  // opportunities, filtered server-side via `rollupAccountId`.
  const meetings = useMeetings({ rollupAccountId: accountId, limit: LIMIT });
  const followUps = useFollowUps({ rollupAccountId: accountId, limit: LIMIT });
  const activities = useActivities({ accountId, limit: LIMIT });
  const tasks = useCrmTasks({ rollupAccountId: accountId, limit: LIMIT });
  const documents = useCrmDocuments({
    rollupAccountId: accountId,
    limit: LIMIT,
  });
  const notes = useCrmNotes({ accountId, limit: LIMIT });
  const quotations = useQuotations({ accountId, limit: LIMIT });

  const opps = opportunities.data?.data ?? [];
  const productQueries = useQueries({
    queries: opps.map((o) => ({
      // Same key as `useOpportunityProducts` so line-item mutations invalidate this too.
      queryKey: orgScopedKey(
        organizationId ?? 0,
        "crm-opportunity-products",
        o.id,
      ),
      queryFn: () => listOpportunityProducts(o.id),
      enabled: Boolean(organizationId),
    })),
  });

  const products = productQueries.flatMap((q, i) => {
    const opportunity = opps[i];
    if (!opportunity) return [];
    return (q.data ?? []).map((item) => ({ item, opportunity }));
  });

  return {
    loading: contacts.isPending || opportunities.isPending,
    contacts: contacts.data?.data ?? [],
    opportunities: opps,
    meetings: meetings.data?.data ?? [],
    followUps: followUps.data?.data ?? [],
    activities: activities.data?.data ?? [],
    tasks: tasks.data?.data ?? [],
    documents: documents.data?.data ?? [],
    notes: notes.data?.data ?? [],
    quotations: quotations.data?.data ?? [],
    products,
  };
}
