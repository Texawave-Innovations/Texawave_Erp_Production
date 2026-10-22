"use client";

// Port of legacy `intelligence/CrmSearch.tsx` (design, layout and feature set). Legacy rendered it
// as an inline panel of the dashboard; here it lives at /crm/search with the same visual design.
import type { CrmSearchKind, CrmSearchResult } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  Clock3,
  Database,
  Globe2,
  Mail,
  Phone,
  Search as SearchIcon,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import {
  BackToDashboardPanelButton,
  EmptyState,
} from "@/features/crm/dashboard/components/intelligence-ui";
import { useCrmSearch } from "../hooks";

/** Legacy renders two groups: the CRM Core Domain group (Account / Contact / Opportunity /
 * Meeting / Follow-up) and the "sheet tab" group (Lead / Cold Calling / Mining) as detailed rows. */
const DOMAIN_KINDS: readonly CrmSearchKind[] = [
  "Account",
  "Contact",
  "Opportunity",
  "Meeting",
  "Follow-up",
];

const DEBOUNCE_MS = 300;

const SOURCE_ICON: Partial<Record<CrmSearchKind, LucideIcon>> = {
  Lead: Users,
  "Cold Calling": Phone,
  Mining: Database,
};

function KindIcon({ kind }: { kind: CrmSearchKind }) {
  const cls = "h-3.5 w-3.5 text-slate-400 shrink-0";
  if (kind === "Opportunity") return <Briefcase className={cls} />;
  if (kind === "Meeting") return <CalendarClock className={cls} />;
  if (kind === "Follow-up") return <Clock3 className={cls} />;
  if (kind === "Contact") return <User className={cls} />;
  return <Building2 className={cls} />;
}

/** Legacy `SourceTag` — the result kind stands in for the legacy source tab. */
function SourceTag({ kind }: { kind: CrmSearchKind }) {
  const Icon = SOURCE_ICON[kind] ?? Building2;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Icon className="h-3 w-3" /> {kind}
    </span>
  );
}

export function CrmSearchPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const search = useCrmSearch(query);
  const typing = input.trim() !== query;
  const results = useMemo(
    () => (query ? (search.data?.results ?? []) : []),
    [query, search.data],
  );
  const domain = results.filter((r) => DOMAIN_KINDS.includes(r.kind));
  const detailed = results.filter((r) => !DOMAIN_KINDS.includes(r.kind));

  function open(r: CrmSearchResult) {
    if (r.href) router.push(r.href);
  }

  const loading = !!query && (search.isPending || typing);

  return (
    <div className="space-y-6">
      <BackToDashboardPanelButton />

      <div className="flex items-center gap-3">
        <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
          <SearchIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Global CRM Search
          </h2>
          <p className="text-sm text-slate-500">
            Search by company, contact, phone, email, opportunity number, or
            salesperson — across the whole CRM.
          </p>
        </div>
      </div>

      <div className="crm-panel-frame rounded-3xl bg-white p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search company, contact, phone, email, opportunity number, salesperson…"
            aria-label="Search the CRM"
            className="pl-10 h-11 rounded-2xl"
            autoFocus
          />
        </div>
      </div>

      {query && !loading && !search.isError && domain.length > 0 && (
        <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 text-sm font-semibold text-slate-500">
            {domain.length} Account / Contact / Opportunity / Meeting /
            Follow-up match{domain.length === 1 ? "" : "es"}
          </div>
          <div className="max-h-[40vh] overflow-y-auto divide-y divide-slate-100">
            {domain.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={!r.href}
                onClick={() => open(r)}
                className="w-full text-left px-4 py-3 hover:bg-brand-50/40 transition-colors flex items-center justify-between gap-3 disabled:cursor-default"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <KindIcon kind={r.kind} />
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
        {!query ? (
          <EmptyState
            icon={SearchIcon}
            title="Start typing to search"
            description="Results span every CRM tab in one place."
          />
        ) : loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Loading CRM data…
          </div>
        ) : search.isError ? (
          <div className="py-10 text-center">
            {search.error instanceof ApiError &&
            search.error.isPermissionError ? (
              <EmptyState
                icon={SearchIcon}
                title="You don't have access to search"
                description="Ask an administrator for the crm.search.read permission."
              />
            ) : (
              <>
                <EmptyState icon={SearchIcon} title="Search failed" />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void search.refetch()}
                >
                  Retry
                </Button>
              </>
            )}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title={`No matches for "${query}"`}
            description="Try a different name, email, or number."
          />
        ) : detailed.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="No lead or prospecting matches"
            description="Matching accounts, contacts and deals are listed above."
          />
        ) : (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 text-sm font-semibold text-slate-500">
              {detailed.length} result{detailed.length === 1 ? "" : "s"}
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {detailed.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={!r.href}
                  onClick={() => open(r)}
                  className="w-full text-left px-4 py-3.5 hover:bg-brand-50/40 transition-colors flex items-start justify-between gap-4 disabled:cursor-default"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {r.title || "Unknown Company"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 ml-5">
                      {r.prospectName && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <User className="h-3 w-3" /> {r.prospectName}
                          {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                        </span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Mail className="h-3 w-3" /> {r.email}
                        </span>
                      )}
                      {r.phone && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </span>
                      )}
                      {r.domain && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Globe2 className="h-3 w-3" /> {r.domain}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 ml-5 flex items-center gap-2">
                      <SourceTag kind={r.kind} />
                      {r.subtitle && (
                        <span className="text-sm text-slate-400 truncate">
                          {r.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
