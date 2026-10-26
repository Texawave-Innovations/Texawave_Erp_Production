"use client";

import { Search as SearchIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { SCM_CATEGORIES } from "@/components/layout/HorizontalNavbar";

interface SearchEntry {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** The parent group's label (e.g. "Procurement"), shown as context under
   * the result. Omitted for top-level entries outside a group (Overview,
   * Suppliers, Barcode, Master Data). */
  groupLabel?: string;
}

function flattenScmNav(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const cat of SCM_CATEGORIES) {
    if (cat.children?.length) {
      for (const child of cat.children) {
        entries.push({
          id: child.path,
          label: child.label,
          path: child.path,
          icon: child.icon,
          groupLabel: cat.label,
        });
      }
    } else if (cat.path) {
      entries.push({
        id: cat.path,
        label: cat.label,
        path: cat.path,
        icon: cat.icon,
      });
    }
  }
  return entries;
}

// Built once — SCM_CATEGORIES is a static module-level constant, not user data.
const SCM_SEARCH_INDEX = flattenScmNav();
const MAX_RESULTS = 8;

/** SCM's own quick search over every page in `SCM_CATEGORIES` (the same list
 * the top SCM menu renders from), by label and parent group. Picking a
 * result navigates straight there. Scoped to the SCM section header rather
 * than the shared cross-module top bar. */
export function ScmGlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SCM_SEARCH_INDEX.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.groupLabel?.toLowerCase().includes(q) ?? false),
    ).slice(0, MAX_RESULTS);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function goTo(entry: SearchEntry) {
    router.push(entry.path);
    setQuery("");
    setOpen(false);
  }

  function clearQuery() {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (query) clearQuery();
      else setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = results[activeIndex];
      if (entry) goTo(entry);
    }
  }

  return (
    <div className="relative w-full max-w-xs sm:w-56" ref={containerRef}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search SCM..."
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-label="Search SCM pages"
        className="h-8 w-full rounded-lg border border-transparent bg-white/70 pl-8 pr-7 text-theme-sm text-gray-700 placeholder:text-gray-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:bg-gray-900/60 dark:text-gray-200 dark:placeholder:text-gray-500"
      />
      {query ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearQuery}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open && query.trim() ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-80 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-theme-xs text-gray-500">
              No SCM pages match &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(entry)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === activeIndex
                      ? "bg-brand-50 dark:bg-brand-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/15">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-theme-sm font-medium text-gray-900 dark:text-white/90">
                      {entry.label}
                    </span>
                    {entry.groupLabel ? (
                      <span className="block truncate text-theme-xs text-gray-500">
                        {entry.groupLabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
