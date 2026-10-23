// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/search/search.controller.ts and
// apps/api/src/modules/crm/calendar/calendar.controller.ts. See
// packages/api-types/README.md.

/** Legacy `intelligence/CrmSearch.tsx` result kinds. The first five are the
 * "CRM Core Domain" group; Lead / Cold Calling / Mining are the legacy
 * "sheet tab" group. */
export type CrmSearchKind =
  | "Account"
  | "Contact"
  | "Opportunity"
  | "Meeting"
  | "Follow-up"
  | "Lead"
  | "Cold Calling"
  | "Mining";

export interface CrmSearchResult {
  id: string;
  kind: CrmSearchKind;
  recordId: number;
  title: string;
  subtitle: string;
  /** Existing page the result links to; null when no page exists for it. */
  href: string | null;
  accountId: number | null;
  prospectName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  domain?: string | null;
}

export interface CrmSearchResponse {
  query: string;
  results: CrmSearchResult[];
  /** Entity kinds the caller may read (and that were therefore searched). */
  searchedKinds: CrmSearchKind[];
}

export type CrmCalendarItemType = "meeting" | "followup" | "task" | "call";

export interface CrmCalendarEvent {
  id: string;
  recordId: number;
  itemType: CrmCalendarItemType;
  /** ISO timestamp. Date-only sources (meeting, task) are midnight UTC. */
  date: string;
  /** False for date-only sources — the UI must not shift these by timezone. */
  hasTime: boolean;
  title: string;
  subtitle: string;
  relatedType: string;
  relatedId: number;
  accountId: number | null;
  time: string | null;
  assignedTo: string | null;
  status: string | null;
  extra: string | null;
}

export interface CrmCalendarEventsResponse {
  events: CrmCalendarEvent[];
  /** Item types the caller may read (and that were therefore aggregated). */
  includedTypes: CrmCalendarItemType[];
}

export interface QueryCrmCalendarEventsInput {
  /** YYYY-MM-DD, inclusive. Omit for no lower bound (agenda strip). */
  from?: string;
  /** YYYY-MM-DD, inclusive. */
  to?: string;
}

export interface CrmCalendarEventDetail {
  itemType: CrmCalendarItemType;
  record: Record<string, unknown>;
  title: string;
  status: string | null;
  date: string;
  hasTime: boolean;
  account: { id: number; name: string } | null;
  opportunity: { id: number; title: string; accountId: number } | null;
}
