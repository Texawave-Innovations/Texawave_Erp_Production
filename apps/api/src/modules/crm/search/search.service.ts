import { Injectable } from "@nestjs/common";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsService } from "../accounts/accounts.service.js";
import { QueryCrmColdCallingEntryDto } from "../cold-calling/dto/cold-calling.dto.js";
import { CrmColdCallingService } from "../cold-calling/cold-calling.service.js";
import { QueryContactDto } from "../contacts/dto/contact.dto.js";
import { ContactsService } from "../contacts/contacts.service.js";
import { FollowUpsService } from "../follow-ups/follow-ups.service.js";
import { QueryLeadDto } from "../leads/dto/lead.dto.js";
import { LeadsService } from "../leads/leads.service.js";
import { MeetingsService } from "../meetings/meetings.service.js";
import { QueryCrmMiningRowDto } from "../mining-rows/dto/mining-row.dto.js";
import { CrmMiningRowsService } from "../mining-rows/mining-rows.service.js";
import { QueryOpportunityDto } from "../opportunities/dto/opportunity.dto.js";
import { OpportunitiesService } from "../opportunities/opportunities.service.js";
import { holdsRead } from "../shared/crm-read-access.js";

/** Mirrors `CrmSearchKind` / `CrmSearchResult` in packages/api-types. */
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
  href: string | null;
  accountId: number | null;
  prospectName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  domain?: string | null;
}

/** Per-kind cap. Legacy capped the domain group at 50 and the sheet-tab
 * group at 100 results in total; a per-kind cap keeps every group visible. */
const PER_KIND_LIMIT = 25;

function accountHref(accountId: number | null): string | null {
  return accountId === null ? null : `/crm/accounts/${accountId}`;
}

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function listQuery<T extends object>(dto: T, q: Record<string, unknown>): T {
  return Object.assign(dto, { page: 1, limit: PER_KIND_LIMIT }, q);
}

/** Global CRM search (legacy `intelligence/CrmSearch.tsx`). Never reads a
 * table itself: every entity set comes from its owning module's exported
 * service, so that entity's own scope (`.own/.team/.all` or org-wide) is
 * applied by the service that owns it, and an entity type is only queried at
 * all when the caller holds its read permission. */
@Injectable()
export class CrmSearchService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly tenantContext: TenantContextService,
    private readonly accounts: AccountsService,
    private readonly contacts: ContactsService,
    private readonly opportunities: OpportunitiesService,
    private readonly meetings: MeetingsService,
    private readonly followUps: FollowUpsService,
    private readonly leads: LeadsService,
    private readonly coldCalling: CrmColdCallingService,
    private readonly miningRows: CrmMiningRowsService,
  ) {}

  async search(rawQuery: string | undefined) {
    const query = (rawQuery ?? "").trim();
    const granted = await this.permissions.getPermissionsForUser(
      this.tenantContext.getUserId(),
    );
    const can = {
      account: holdsRead(granted, "crm.account.read"),
      contact: holdsRead(granted, "crm.contact.read", true),
      opportunity: holdsRead(granted, "crm.opportunity.read", true),
      meeting: holdsRead(granted, "crm.meeting.read"),
      followUp: holdsRead(granted, "crm.followup.read"),
      lead: holdsRead(granted, "crm.lead.read", true),
      coldCalling: holdsRead(granted, "crm.coldcalling.read"),
      mining: holdsRead(granted, "crm.miningrow.read"),
    };
    const searchedKinds: CrmSearchKind[] = [];
    if (can.account) searchedKinds.push("Account");
    if (can.contact) searchedKinds.push("Contact");
    if (can.opportunity) searchedKinds.push("Opportunity");
    if (can.meeting) searchedKinds.push("Meeting");
    if (can.followUp) searchedKinds.push("Follow-up");
    if (can.lead) searchedKinds.push("Lead");
    if (can.coldCalling) searchedKinds.push("Cold Calling");
    if (can.mining) searchedKinds.push("Mining");
    if (!query)
      return { query, results: [] as CrmSearchResult[], searchedKinds };

    // Meetings / follow-ups also match by their account's name (legacy),
    // which is only allowed when the caller may read accounts.
    const matchedAccounts = can.account
      ? await this.accounts.search(query, PER_KIND_LIMIT * 4)
      : [];
    const matchedAccountIds = matchedAccounts.map((a) => a.id);

    const [contacts, opps, meetings, followUps, leads, cold, mining] =
      await Promise.all([
        can.contact
          ? this.contacts.findAll(
              listQuery(new QueryContactDto(), { q: query }),
            )
          : null,
        can.opportunity
          ? this.opportunities.findAll(
              listQuery(new QueryOpportunityDto(), { q: query }),
            )
          : null,
        can.meeting
          ? this.meetings.findFeed(
              { q: query, relatedAccountIds: matchedAccountIds },
              PER_KIND_LIMIT,
            )
          : null,
        can.followUp
          ? this.followUps.findFeed(
              { q: query, relatedAccountIds: matchedAccountIds },
              PER_KIND_LIMIT,
            )
          : null,
        can.lead
          ? this.leads.findAll(listQuery(new QueryLeadDto(), { q: query }))
          : null,
        can.coldCalling
          ? this.coldCalling.findAll(
              listQuery(new QueryCrmColdCallingEntryDto(), { search: query }),
            )
          : null,
        can.mining
          ? this.miningRows.findAll(
              listQuery(new QueryCrmMiningRowDto(), { search: query }),
            )
          : null,
      ]);

    const nameIds = new Set<number>(matchedAccountIds);
    for (const m of meetings ?? [])
      if (m.relatedType === "account") nameIds.add(m.relatedId);
    for (const f of followUps ?? [])
      if (f.relatedType === "account") nameIds.add(f.relatedId);
    const names = can.account
      ? await this.accounts.namesByIds([...nameIds])
      : new Map<number, string>();
    const accountName = (id: number) => names.get(id) ?? "Unknown Account";

    const results: CrmSearchResult[] = [];
    for (const a of matchedAccounts.slice(0, PER_KIND_LIMIT)) {
      results.push({
        id: `account_${a.id}`,
        kind: "Account",
        recordId: a.id,
        title: a.name,
        subtitle: a.ownerName ? `Owner: ${a.ownerName}` : "",
        href: accountHref(a.id),
        accountId: a.id,
      });
    }
    for (const c of contacts?.items ?? []) {
      results.push({
        id: `contact_${c.id}`,
        kind: "Contact",
        recordId: c.id,
        title: c.name,
        subtitle: c.account.name,
        href: accountHref(c.accountId),
        accountId: c.accountId,
        email: c.email,
        phone: c.phone,
        jobTitle: c.designation,
      });
    }
    for (const o of opps?.items ?? []) {
      results.push({
        id: `opportunity_${o.id}`,
        kind: "Opportunity",
        recordId: o.id,
        title: `${o.title} (${o.opportunityNumber})`,
        subtitle: `${o.account.name} · Owner: ${o.ownerName}`,
        href: accountHref(o.accountId),
        accountId: o.accountId,
      });
    }
    for (const m of meetings ?? []) {
      const isAccount = m.relatedType === "account";
      results.push({
        id: `meeting_${m.id}`,
        kind: "Meeting",
        recordId: m.id,
        title: `${m.mode} meeting — ${day(m.meetingDate)}`,
        subtitle: isAccount ? accountName(m.relatedId) : "",
        href: isAccount ? accountHref(m.relatedId) : null,
        accountId: isAccount ? m.relatedId : null,
      });
    }
    for (const f of followUps ?? []) {
      const isAccount = f.relatedType === "account";
      results.push({
        id: `followup_${f.id}`,
        kind: "Follow-up",
        recordId: f.id,
        title: `${f.type} follow-up — ${day(f.scheduledAt)}`,
        subtitle: `${isAccount ? accountName(f.relatedId) : ""} · ${f.assignedTo}`,
        href: isAccount ? accountHref(f.relatedId) : null,
        accountId: isAccount ? f.relatedId : null,
      });
    }
    for (const l of leads?.items ?? []) {
      results.push({
        id: `lead_${l.id}`,
        kind: "Lead",
        recordId: l.id,
        title: l.companyName,
        subtitle: l.leadStatus,
        href: `/crm/leads/${l.id}`,
        accountId: null,
        prospectName: l.prospectName,
        jobTitle: l.title,
        email: l.email,
        phone: l.contactNumber,
        domain: l.domain,
      });
    }
    for (const c of cold?.items ?? []) {
      results.push({
        id: `coldcalling_${c.id}`,
        kind: "Cold Calling",
        recordId: c.id,
        title: c.companyName,
        subtitle: c.status ?? "",
        href: `/crm/cold-calling-status?q=${encodeURIComponent(c.companyName)}`,
        accountId: c.linkedAccountId,
        prospectName: c.prospectName,
        jobTitle: c.designation,
      });
    }
    for (const r of mining?.items ?? []) {
      results.push({
        id: `mining_${r.id}`,
        kind: "Mining",
        recordId: r.id,
        title: r.companyName,
        subtitle: r.followUpStatus ?? "",
        href: `/crm/accounts-mining-sheet?q=${encodeURIComponent(r.companyName)}`,
        accountId: null,
        prospectName: r.keyDecisionMakers,
        jobTitle: r.title,
        email: r.email,
        phone: r.contactNumber,
        domain: r.domain,
      });
    }
    return { query, results, searchedKinds };
  }
}
