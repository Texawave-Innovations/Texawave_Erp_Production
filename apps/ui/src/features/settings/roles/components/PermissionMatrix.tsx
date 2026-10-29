"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CreditCard,
  Folder,
  Layers,
  Lock,
  Search,
  Settings2,
  Shield,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Button, Card, Checkbox, Input, cn } from "@texawave-erp/ui-kit";
import {
  levelOf,
  withLevel,
  type AccessAction,
  type AccessSection,
  type Level,
} from "../utils/access-model";
import { ScopeControl } from "./ScopeControl";

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  admin: Shield,
  masters: Layers,
  people: Users,
  time: Clock,
  workflows: ClipboardCheck,
  recruitment: Briefcase,
  payroll: CreditCard,
  self: UserCheck,
  other: Folder,
};

interface SearchResultItem {
  sectionKey: string;
  sectionLabel: string;
  resourceKey: string;
  resourceLabel: string;
  action: AccessAction;
}

/**
 * Three-region Role Permissions Workspace:
 * 1. Global search, filters, and scope legend bar.
 * 2. Persistent left category sidebar with icons, active state, and granted/total counters.
 * 3. Main category permission workspace displaying resources and actions with ScopeControl.
 */
export function PermissionMatrix({
  sections,
  draft,
  baseline,
  onChange,
  readOnly,
}: {
  sections: readonly AccessSection[];
  draft: ReadonlySet<number>;
  /** The saved grant set, to mark changed rows. */
  baseline: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  readOnly: boolean;
}) {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(
    () => sections[0]?.key ?? "admin",
  );
  const [query, setQuery] = useState("");
  const [grantedOnly, setGrantedOnly] = useState(false);
  const [highlightedPermissionCode, setHighlightedPermissionCode] = useState<
    string | null
  >(null);
  const [showSearchResultsList, setShowSearchResultsList] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Clear highlighted permission ring after 2.5s
  useEffect(() => {
    if (!highlightedPermissionCode) return;
    const timer = setTimeout(() => setHighlightedPermissionCode(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightedPermissionCode]);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResultsList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute stats per category: granted actions vs total actions
  const categoryStats = useMemo(() => {
    const stats: Record<string, { granted: number; total: number }> = {};
    for (const s of sections) {
      let granted = 0;
      let total = 0;
      for (const r of s.resources) {
        for (const a of r.actions) {
          total++;
          if (levelOf(a, draft) !== "none") granted++;
        }
      }
      stats[s.key] = { granted, total };
    }
    return stats;
  }, [sections, draft]);

  // Overall totals across the whole role
  const { totalGrantedCount, totalActionCount } = useMemo(() => {
    let totalGrantedCount = 0;
    let totalActionCount = 0;
    for (const stat of Object.values(categoryStats)) {
      totalGrantedCount += stat.granted;
      totalActionCount += stat.total;
    }
    return { totalGrantedCount, totalActionCount };
  }, [categoryStats]);

  // Global search across ALL categories
  const allMatches = useMemo<SearchResultItem[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const results: SearchResultItem[] = [];
    for (const s of sections) {
      for (const r of s.resources) {
        for (const a of r.actions) {
          if (grantedOnly && levelOf(a, draft) === "none") continue;
          if (
            r.label.toLowerCase().includes(needle) ||
            a.label.toLowerCase().includes(needle) ||
            a.description.toLowerCase().includes(needle) ||
            a.code.toLowerCase().includes(needle)
          ) {
            results.push({
              sectionKey: s.key,
              sectionLabel: s.label,
              resourceKey: r.key,
              resourceLabel: r.label,
              action: a,
            });
          }
        }
      }
    }
    return results;
  }, [sections, query, grantedOnly, draft]);

  // Count matches per category
  const categoryMatches = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const m of allMatches) {
      counts[m.sectionKey] = (counts[m.sectionKey] ?? 0) + 1;
    }
    return counts;
  }, [allMatches]);

  // Matches in categories other than the currently selected one
  const otherCategoryMatches = useMemo(() => {
    if (!query.trim()) return [];
    return Object.entries(categoryMatches).filter(
      ([key, count]) => key !== selectedCategoryKey && count > 0,
    );
  }, [categoryMatches, selectedCategoryKey, query]);

  // Current active section
  const currentSection = useMemo(() => {
    return (
      sections.find((s) => s.key === selectedCategoryKey) ?? sections[0] ?? null
    );
  }, [sections, selectedCategoryKey]);

  // Filtered resources and actions for the current active section
  const currentVisibleResources = useMemo(() => {
    if (!currentSection) return [];
    const needle = query.trim().toLowerCase();
    return currentSection.resources
      .map((r) => ({
        ...r,
        actions: r.actions.filter((a) => {
          if (grantedOnly && levelOf(a, draft) === "none") return false;
          if (needle === "") return true;
          return (
            r.label.toLowerCase().includes(needle) ||
            a.label.toLowerCase().includes(needle) ||
            a.description.toLowerCase().includes(needle) ||
            a.code.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((r) => r.actions.length > 0);
  }, [currentSection, query, grantedOnly, draft]);

  // Clear all permissions in a category
  function clearCategory(section: AccessSection) {
    const next = new Set(draft);
    for (const id of section.permissionIds) next.delete(id);
    onChange(next);
  }

  // Handle navigating from global search results to a specific permission
  const handleSelectSearchResult = (result: SearchResultItem) => {
    setSelectedCategoryKey(result.sectionKey);
    setHighlightedPermissionCode(result.action.code);
    setShowSearchResultsList(false);
    setMobileMenuOpen(false);

    // Scroll into view with slight delay to allow category DOM render
    setTimeout(() => {
      const el = document.getElementById(`perm-${result.action.code}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
  };

  const searching = query.trim() !== "";
  const currentSectionStats = currentSection
    ? (categoryStats[currentSection.key] ?? { granted: 0, total: 0 })
    : { granted: 0, total: 0 };
  const ActiveCategoryIcon = currentSection
    ? (CATEGORY_ICONS[currentSection.key] ?? Settings2)
    : Settings2;

  return (
    <div className="flex flex-col gap-4">
      {/* Region 4: Search, Filters, and Scope Legend Toolbar */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div ref={searchContainerRef} className="relative flex-1 max-w-lg">
            <Input
              type="search"
              aria-label="Search permissions across all categories"
              placeholder="Search permissions across all categories…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSearchResultsList(true);
              }}
              onFocus={() => {
                if (query.trim()) setShowSearchResultsList(true);
              }}
              className="h-10 pl-9 pr-8 text-theme-sm"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setShowSearchResultsList(false);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            {/* Cross-Category Search Auto-suggest Panel */}
            {showSearchResultsList && searching && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span>Search results ({allMatches.length})</span>
                  <span className="text-[10px] font-normal lowercase">
                    Click to navigate
                  </span>
                </div>
                {allMatches.length === 0 ? (
                  <div className="p-3 text-center text-theme-xs text-gray-500">
                    No permissions match &quot;{query}&quot;
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {allMatches.slice(0, 15).map((match) => (
                      <button
                        key={`${match.sectionKey}-${match.action.code}`}
                        type="button"
                        onClick={() => handleSelectSearchResult(match)}
                        className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-theme-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                            <span>
                              {match.resourceLabel} · {match.action.label}
                            </span>
                            {match.action.sensitive && (
                              <AlertTriangle className="h-3 w-3 text-warning-600 shrink-0" />
                            )}
                          </div>
                          <p className="line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {match.action.description || match.action.code}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {match.sectionLabel}
                        </span>
                      </button>
                    ))}
                    {allMatches.length > 15 ? (
                      <div className="px-2.5 py-1.5 text-center text-[11px] text-gray-400">
                        + {allMatches.length - 15} more matches. Narrow search
                        query for specifics.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-theme-xs font-medium text-gray-700 dark:text-gray-300">
              <Checkbox
                checked={grantedOnly}
                onChange={(e) => setGrantedOnly(e.target.checked)}
              />
              <span>Show granted only</span>
            </label>
            <div className="hidden h-4 w-px bg-gray-200 sm:block dark:bg-gray-800" />
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Total:{" "}
              <strong className="font-semibold text-gray-900 dark:text-white">
                {totalGrantedCount}
              </strong>{" "}
              / {totalActionCount} granted
            </span>
          </div>
        </div>

        {/* Scope Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Scope Legend:
          </span>
          <span>
            <strong className="text-gray-700 dark:text-gray-300">Own</strong> =
            user&apos;s own records
          </span>
          <span>•</span>
          <span>
            <strong className="text-gray-700 dark:text-gray-300">Team</strong> =
            records within user&apos;s assigned teams
          </span>
          <span>•</span>
          <span>
            <strong className="text-gray-700 dark:text-gray-300">All</strong> =
            system-wide records across all teams
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Lock className="inline h-3 w-3 text-gray-400" />
            <span>= locked scope</span>
          </span>
        </div>
      </Card>

      {/* Cross-Category Search Match Pill Banner */}
      {searching && otherCategoryMatches.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200/80 bg-brand-50/50 p-2.5 dark:border-brand-900/40 dark:bg-brand-950/20">
          <span className="text-theme-xs font-medium text-brand-800 dark:text-brand-300 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Matches found in other categories:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {otherCategoryMatches.map(([sKey, count]) => {
              const sObj = sections.find((s) => s.key === sKey);
              if (!sObj) return null;
              return (
                <button
                  key={sKey}
                  type="button"
                  onClick={() => setSelectedCategoryKey(sKey)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-theme-xs font-semibold text-brand-700 shadow-xs transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950"
                >
                  <span>{sObj.label}</span>
                  <span className="rounded-full bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Mobile Category Dropdown Selector */}
      <div className="block lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-theme-sm font-semibold text-gray-900 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-white"
        >
          <div className="flex items-center gap-2.5">
            <ActiveCategoryIcon className="h-4 w-4 text-brand-600" />
            <span>Category: {currentSection?.label}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              mobileMenuOpen && "rotate-180",
            )}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-md dark:border-gray-800 dark:bg-gray-900">
            {sections.map((section) => {
              const isSelected = section.key === selectedCategoryKey;
              const stats = categoryStats[section.key] ?? {
                granted: 0,
                total: 0,
              };
              const Icon = CATEGORY_ICONS[section.key] ?? Settings2;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryKey(section.key);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-theme-xs font-medium",
                    isSelected
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{section.label}</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500">
                    {stats.granted}/{stats.total}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Workspace 2-Column Grid (Region 2: Left Category Sidebar + Region 3: Main Permission Panel) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[17rem_1fr] xl:grid-cols-[18.5rem_1fr]">
        {/* Region 2: Persistent Left Category Sidebar */}
        <Card className="hidden p-2 lg:block sticky top-4 shadow-theme-xs">
          <div className="mb-1.5 flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <span className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Categories ({sections.length})
            </span>
          </div>

          <nav
            aria-label="Permission categories"
            className="flex flex-col gap-1"
          >
            {sections.map((section) => {
              const isSelected = section.key === selectedCategoryKey;
              const stats = categoryStats[section.key] ?? {
                granted: 0,
                total: 0,
              };
              const matches = categoryMatches[section.key] ?? 0;
              const Icon = CATEGORY_ICONS[section.key] ?? Settings2;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setSelectedCategoryKey(section.key)}
                  className={cn(
                    "group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-theme-xs transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    isSelected
                      ? "bg-brand-50 text-brand-900 font-semibold ring-1 ring-brand-500/30 shadow-xs dark:bg-brand-950/50 dark:text-brand-200 dark:ring-brand-500/40"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-gray-700",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{section.label}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {searching && matches > 0 ? (
                      <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                        {matches}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium transition-colors",
                        isSelected
                          ? "bg-brand-100/80 text-brand-800 dark:bg-brand-900/50 dark:text-brand-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        stats.granted > 0 &&
                          stats.granted === stats.total &&
                          "text-emerald-700 dark:text-emerald-400 font-semibold",
                      )}
                    >
                      {stats.granted}/{stats.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Region 3: Main Permission Workspace (Selected Category) */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {currentSection && (
            <Card className="p-4 sm:p-5 shadow-theme-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-200/80 bg-brand-50 text-brand-600 shadow-xs dark:border-brand-800/80 dark:bg-brand-950 dark:text-brand-400">
                    <ActiveCategoryIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-theme-base font-bold text-gray-900 dark:text-white">
                        {currentSection.label}
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {currentSectionStats.granted} of{" "}
                        {currentSectionStats.total} granted
                      </span>
                    </div>
                    {currentSection.description ? (
                      <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                        {currentSection.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!readOnly && currentSectionStats.granted > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => clearCategory(currentSection)}
                      className="text-theme-xs text-gray-600 hover:text-error-600 dark:text-gray-400 dark:hover:text-error-400"
                    >
                      Clear category
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          )}

          {/* Permission Rows Grouped by Resource */}
          {currentVisibleResources.length === 0 ? (
            <Card className="p-8 text-center">
              {searching ? (
                <div>
                  <p className="text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
                    No permissions in {currentSection?.label} match &quot;
                    {query}&quot;
                  </p>
                  {otherCategoryMatches.length > 0 ? (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <p className="text-theme-xs text-gray-500">
                        Matches were found in other categories. Click to
                        navigate:
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {otherCategoryMatches.map(([sKey, count]) => {
                          const sObj = sections.find((s) => s.key === sKey);
                          if (!sObj) return null;
                          return (
                            <Button
                              key={sKey}
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedCategoryKey(sKey)}
                              className="gap-1.5 text-theme-xs"
                            >
                              <span>{sObj.label}</span>
                              <span className="rounded-full bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-700">
                                {count}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setQuery("")}
                      className="mt-4"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : grantedOnly ? (
                <div>
                  <p className="text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
                    No granted permissions in {currentSection?.label}
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-500">
                    This role currently has no permissions granted in this
                    category.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setGrantedOnly(false)}
                    className="mt-4"
                  >
                    Show all permissions
                  </Button>
                </div>
              ) : (
                <p className="text-theme-sm text-gray-500">
                  No permissions found in this category.
                </p>
              )}
            </Card>
          ) : (
            currentVisibleResources.map((resource) => (
              <Card
                key={resource.key}
                className="overflow-hidden border border-gray-200/80 p-0 shadow-theme-xs dark:border-gray-800"
              >
                {/* Resource Header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center gap-2">
                    <h4 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {resource.label}
                    </h4>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {resource.actions.length} action
                      {resource.actions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {/* Actions List with ScopeControls */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {resource.actions.map((action) => {
                    const level = levelOf(action, draft);
                    const changed = level !== levelOf(action, baseline);
                    const isHighlighted =
                      highlightedPermissionCode === action.code;

                    return (
                      <div
                        key={action.code}
                        id={`perm-${action.code}`}
                        className={cn(
                          "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-all duration-300",
                          isHighlighted &&
                            "bg-brand-50/80 ring-2 ring-brand-500 ring-inset dark:bg-brand-950/60",
                          !isHighlighted &&
                            "hover:bg-gray-50/40 dark:hover:bg-gray-800/20",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-theme-sm text-gray-900 dark:text-gray-100">
                              {action.label}
                            </span>
                            {action.sensitive ? (
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/30"
                                title="High-impact sensitive permission"
                              >
                                <AlertTriangle
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                Sensitive
                              </span>
                            ) : null}
                            {changed ? (
                              <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-800 dark:bg-warning-950 dark:text-warning-300">
                                changed
                              </span>
                            ) : null}
                            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                              {action.code}
                            </span>
                          </div>
                          {action.description ? (
                            <p className="max-w-2xl text-theme-xs text-gray-500 dark:text-gray-400">
                              {action.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center">
                          <ScopeControl
                            action={action}
                            level={level}
                            disabled={readOnly}
                            labelPrefix={resource.label}
                            onChange={(next: Level) =>
                              onChange(withLevel(action, draft, next))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
