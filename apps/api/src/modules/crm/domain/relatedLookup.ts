// CRM Core Domain — shared helper to resolve the owning Account for any `relatedType`/`relatedId`
// pair (Activity/Task/Follow-up/Meeting/Document all use this shape). Used by the operational
// tabs (Yet to Happen, WhatsApp, LinkedIn) so they can join back to the single-source-of-truth
// Account/Contact/Opportunity records instead of maintaining their own copy of that link.
import {
  CrmActivity,
  CrmContact,
  CrmDealProduct,
  CrmDocument,
  CrmFollowUp,
  CrmMeeting,
  CrmOpportunity,
  CrmQuotation,
  CrmRelatedType,
  CrmTask,
} from "./types";

export function resolveAccountId(
  relatedType: CrmRelatedType,
  relatedId: string,
  contacts: CrmContact[],
  opportunities: CrmOpportunity[],
): string | undefined {
  if (relatedType === "account") return relatedId;
  if (relatedType === "contact")
    return contacts.find((c) => c.id === relatedId)?.accountId;
  if (relatedType === "opportunity")
    return opportunities.find((o) => o.id === relatedId)?.accountId;
  return undefined;
}

export interface AccountRelatedIds {
  contactIds: string[];
  opportunityIds: string[];
  meetingIds: string[];
  followUpIds: string[];
  activityIds: string[];
  quotationIds: string[];
  documentIds: string[];
  taskIds: string[];
  dealProductIds: string[];
}

/** Every record id related to an Account, for cascade-delete (soft-delete + Recycle Bin) and for
 *  the confirm-dialog warning text that previews it. Single source of truth for "everything tied
 *  to this account" — Accounts.tsx (list-row delete) and AccountDetail.tsx (detail-page delete,
 *  including its warning-text totals) both call this instead of each hand-building their own
 *  related-ids bundle, which had already drifted (one omitted `dealProductIds`, the other omitted
 *  `taskIds`) and would keep silently missing whichever child collection is added next. */
export function computeAccountRelatedIds(
  accountId: string,
  data: {
    contacts: CrmContact[];
    opportunities: CrmOpportunity[];
    meetings: CrmMeeting[];
    followUps: CrmFollowUp[];
    activities: CrmActivity[];
    quotations: CrmQuotation[];
    documents: CrmDocument[];
    tasks: CrmTask[];
    dealProducts: CrmDealProduct[];
  },
): AccountRelatedIds {
  const accountContacts = data.contacts.filter(
    (c) => c.accountId === accountId,
  );
  const accountOpportunities = data.opportunities.filter(
    (o) => o.accountId === accountId,
  );
  const relevantIds = new Set([
    accountId,
    ...accountOpportunities.map((o) => o.id),
    ...accountContacts.map((c) => c.id),
  ]);
  return {
    contactIds: accountContacts.map((c) => c.id),
    opportunityIds: accountOpportunities.map((o) => o.id),
    meetingIds: data.meetings
      .filter((m) => relevantIds.has(m.relatedId))
      .map((m) => m.id),
    followUpIds: data.followUps
      .filter((f) => relevantIds.has(f.relatedId))
      .map((f) => f.id),
    activityIds: data.activities
      .filter((a) => relevantIds.has(a.relatedId))
      .map((a) => a.id),
    quotationIds: data.quotations
      .filter((q) => q.accountId === accountId)
      .map((q) => q.id),
    documentIds: data.documents
      .filter((d) => relevantIds.has(d.relatedId))
      .map((d) => d.id),
    taskIds: data.tasks
      .filter((t) => relevantIds.has(t.relatedId))
      .map((t) => t.id),
    dealProductIds: data.dealProducts
      .filter((dp) =>
        accountOpportunities.some((o) => o.id === dp.opportunityId),
      )
      .map((dp) => dp.id),
  };
}
