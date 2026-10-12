// Feature 2 — Global CRM Search. Reads across all 8 existing source tabs and presents a unified,
// read-only search experience. Never modifies any source data.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  Building2,
  CalendarClock,
  Clock3,
  User,
  Mail,
  Phone,
  Globe2,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCrmSourceData } from "./useCrmSourceData";
import { buildActivities } from "./unify";
import { EmptyState, SourceTag } from "./components";
import { TAB_META } from "./tabMeta";
import { UnifiedCrmActivity } from "./types";
import { useCrmDomainData } from "../domain/useCrmDomainData";

function matches(activity: UnifiedCrmActivity, query: string): boolean {
  const q = query.toLowerCase();
  // `sourceRowId` (the sheet row's Firebase push id) doubles as this row's "Lead ID" — searchable
  // so a lead can be found by id, not just by name/contact fields.
  return [
    activity.companyName,
    activity.prospectName,
    activity.email,
    activity.contactNumber,
    activity.domain,
    activity.sourceRowId,
  ]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(q));
}

interface DomainResult {
  id: string;
  kind: "Account" | "Contact" | "Opportunity" | "Meeting" | "Follow-up";
  title: string;
  subtitle: string;
  accountId: string;
}

export default function CrmSearch() {
  const navigate = useNavigate();
  const { sources, loading } = useCrmSourceData();
  const activities = useMemo(() => buildActivities(sources), [sources]);
  const [query, setQuery] = useState("");

  // CRM Core Domain (Accounts/Contacts/Opportunities/Meetings/Follow-ups) — a separate relational
  // dataset from the 8 sheet tabs above, surfaced here as its own labeled result group per the
  // "identify the entity type: Lead / Account / Contact / Opportunity / Meeting / Follow-up"
  // requirement.
  const {
    accounts,
    contacts,
    opportunities,
    meetings,
    followUps,
    loading: domainLoading,
  } = useCrmDomainData();
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";

  const domainResults = useMemo((): DomainResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: DomainResult[] = [];
    accounts.forEach((a) => {
      if (
        [a.name, a.email, a.phone, a.ownerName].some((f) =>
          (f || "").toLowerCase().includes(q),
        )
      ) {
        out.push({
          id: `account_${a.id}`,
          kind: "Account",
          title: a.name,
          subtitle: a.ownerName ? `Owner: ${a.ownerName}` : "",
          accountId: a.id,
        });
      }
    });
    contacts.forEach((c) => {
      if (
        [c.name, c.email, c.phone, c.whatsapp].some((f) =>
          (f || "").toLowerCase().includes(q),
        )
      ) {
        out.push({
          id: `contact_${c.id}`,
          kind: "Contact",
          title: c.name,
          subtitle: accountName(c.accountId),
          accountId: c.accountId,
        });
      }
    });
    opportunities.forEach((o) => {
      if (
        [o.title, o.ownerName, o.id, o.opportunityNumber].some((f) =>
          (f || "").toLowerCase().includes(q),
        )
      ) {
        out.push({
          id: `opportunity_${o.id}`,
          kind: "Opportunity",
          title: `${o.title}${o.opportunityNumber ? ` (${o.opportunityNumber})` : ""}`,
          subtitle: `${accountName(o.accountId)} · Owner: ${o.ownerName}`,
          accountId: o.accountId,
        });
      }
    });
    meetings.forEach((m) => {
      if (
        [m.mode, m.agenda, m.participants, accountName(m.relatedId)].some((f) =>
          (f || "").toLowerCase().includes(q),
        )
      ) {
        out.push({
          id: `meeting_${m.id}`,
          kind: "Meeting",
          title: `${m.mode} meeting — ${m.date}`,
          subtitle: accountName(m.relatedId),
          accountId: m.relatedId,
        });
      }
    });
    followUps.forEach((f) => {
      if (
        [f.type, f.assignedTo, f.notes, accountName(f.relatedId)].some((v) =>
          (v || "").toLowerCase().includes(q),
        )
      ) {
        out.push({
          id: `followup_${f.id}`,
          kind: "Follow-up",
          title: `${f.type} follow-up — ${f.scheduledAt}`,
          subtitle: `${accountName(f.relatedId)} · ${f.assignedTo}`,
          accountId: f.relatedId,
        });
      }
    });
    return out.slice(0, 50);
  }, [accounts, contacts, opportunities, meetings, followUps, query]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return activities.filter((a) => matches(a, q)).slice(0, 100);
  }, [activities, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
          <SearchIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Global CRM Search
          </h2>
          <p className="text-sm text-slate-500">
            Search by company, contact, phone, email, Lead ID, opportunity
            number, or salesperson — across the whole CRM.
          </p>
        </div>
      </div>

      <div className="crm-panel-frame rounded-3xl bg-white p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, contact, phone, email, Lead ID, opportunity number, salesperson…"
            className="pl-10 h-11 rounded-2xl"
            autoFocus
          />
        </div>
      </div>

      {!domainLoading && query.trim() && domainResults.length > 0 && (
        <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 text-sm font-semibold text-slate-500">
            {domainResults.length} Account / Contact / Opportunity / Meeting /
            Follow-up match{domainResults.length === 1 ? "" : "es"}
          </div>
          <div className="max-h-[40vh] overflow-y-auto divide-y divide-slate-100">
            {domainResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/crm/accounts/${r.accountId}`)}
                className="w-full text-left px-4 py-3 hover:bg-brand-50/40 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  {r.kind === "Opportunity" ? (
                    <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : r.kind === "Meeting" ? (
                    <CalendarClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : r.kind === "Follow-up" ? (
                    <Clock3 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : r.kind === "Contact" ? (
                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {r.title}
                    </p>
                    {r.subtitle && (
                      <p className="text-sm text-slate-500 truncate">
                        {r.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {r.kind}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Loading CRM data…
          </div>
        ) : !query.trim() ? (
          <EmptyState
            icon={SearchIcon}
            title="Start typing to search"
            description="Results span every CRM tab in one place."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title={`No matches for "${query}"`}
            description="Try a different name, email, or number."
          />
        ) : (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 text-sm font-semibold text-slate-500">
              {results.length} result{results.length === 1 ? "" : "s"}
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {results.map((a) => {
                const meta = TAB_META[a.sourceTab];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      navigate(`${meta.route}?row=${a.sourceRowId}`)
                    }
                    className="w-full text-left px-4 py-3.5 hover:bg-brand-50/40 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {a.companyName || "Unknown Company"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 ml-5">
                        {a.prospectName && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <User className="h-3 w-3" /> {a.prospectName}
                            {a.title ? ` · ${a.title}` : ""}
                          </span>
                        )}
                        {a.email && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <Mail className="h-3 w-3" /> {a.email}
                          </span>
                        )}
                        {a.contactNumber && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone className="h-3 w-3" /> {a.contactNumber}
                          </span>
                        )}
                        {a.domain && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <Globe2 className="h-3 w-3" /> {a.domain}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 ml-5 flex items-center gap-2">
                        <SourceTag sourceTab={a.sourceTab} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/company/${a.companyKey}`);
                          }}
                          className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-0.5"
                        >
                          View Company 360 <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
