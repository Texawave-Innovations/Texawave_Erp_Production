"use client";

import {
  ArrowRight,
  Clock,
  FileText,
  PlusCircle,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { Semantic3DIcon, type Icon3DName } from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useEmployees } from "@/features/hr/employees/hooks";

/**
 * Global search / quick jump for the top bars (HR workspace HorizontalNavbar
 * and the employee portal header).
 *
 * - Pages: the caller passes ONLY the pages the user may open (the same
 *   menu/permission filter that builds its navigation), so a role never sees
 *   a result it cannot use. Matching is client-side on label, section and
 *   keywords.
 * - Actions: same, for a few task shortcuts that have their own page.
 * - Employees (optional): looked up through the existing employee list API
 *   (`GET /hr/employees?search=`), which scopes rows to the caller's teams.
 * - Recent: the last pages opened from here, kept per browser (best effort).
 *
 * Keyboard: Ctrl/⌘ + K or "/" focuses it from anywhere; ↑/↓ move, Enter
 * opens, Esc closes.
 */

export interface SearchEntry {
  /** Unique; defaults to the path. */
  id?: string;
  label: string;
  path: string;
  /** Where it lives, e.g. "Human Resources › People". */
  context?: string;
  /** Extra words that should find it ("payslip", "salary"…). */
  keywords?: readonly string[];
  kind: "page" | "action";
  /** The module's 3D icon (as in the HR top bar), so the module is obvious. */
  icon3d?: Icon3DName;
  /** A flat icon when there is no module icon (e.g. the portal sidebar's). */
  icon?: LucideIcon;
}

/** Everyday words people type for a page, matched on its path. */
const KEYWORDS_BY_PATH: readonly [string, readonly string[]][] = [
  ["payslip", ["salary", "pay slip", "payroll"]],
  ["leave", ["holiday", "vacation", "time off", "apply leave"]],
  ["attendance", ["check in", "check out", "punch", "present", "absent"]],
  ["checkin", ["check in", "check out", "punch"]],
  ["employees", ["staff", "people", "directory", "employee"]],
  ["expense", ["reimbursement", "claim", "bill"]],
  ["ticket", ["help", "support", "issue", "complaint"]],
  ["exit", ["resign", "resignation", "relieving"]],
  ["timesheet", ["hours", "time log", "work log"]],
  ["permissions", ["short leave", "permission"]],
  ["tax", ["tds", "declaration", "investment"]],
  ["loans", ["advance", "loan"]],
  [
    "masters/hr",
    ["department", "designation", "shift", "leave type", "auto checkout"],
  ],
];

/** Extra search words for a path (see KEYWORDS_BY_PATH). */
export function keywordsFor(path: string): string[] {
  const p = path.toLowerCase();
  return KEYWORDS_BY_PATH.filter(([key]) => p.includes(key)).flatMap(
    ([, words]) => words,
  );
}

interface Option {
  id: string;
  label: string;
  context: string | undefined;
  path: string;
  group: "Recent" | "Pages" | "Actions" | "Employees";
  icon3d: Icon3DName | undefined;
  icon: LucideIcon | undefined;
}

const RECENT_KEY = "texawave.globalSearch.recent";
const MAX_RECENT = 5;
const MAX_PAGES = 8;
const MAX_ACTIONS = 4;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}

function pushRecent(path: string): void {
  try {
    const next = [path, ...readRecent().filter((p) => p !== path)].slice(
      0,
      MAX_RECENT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, blocked) — recents are optional.
  }
}

/** 0 = no match. Every word typed must appear somewhere; the label counts most. */
function score(entry: SearchEntry, words: readonly string[]): number {
  const label = entry.label.toLowerCase();
  const rest = [entry.context ?? "", ...(entry.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  let total = 0;
  for (const w of words) {
    if (label.startsWith(w)) total += 4;
    else if (label.split(/\s+/).some((part) => part.startsWith(w))) total += 3;
    else if (label.includes(w)) total += 2;
    else if (rest.includes(w)) total += 1;
    else return 0;
  }
  return total;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

const GROUP_ICON = {
  Recent: Clock,
  Pages: FileText,
  Actions: PlusCircle,
  Employees: User,
} as const;

export function GlobalSearch({
  entries,
  employeeLookup = false,
  className = "",
}: {
  entries: readonly SearchEntry[];
  /** Also look up employees by name / code / e-mail (caller checks permission). */
  employeeLookup?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Ctrl/⌘+K anywhere, or "/" when not already typing somewhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey);
      const isSlash = e.key === "/" && !isTypingTarget(e.target);
      if (isK || isSlash) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const employees = useEmployees(
    { page: 1, limit: 5, search: debounced },
    employeeLookup && debounced.length >= 2,
  );

  const options = useMemo<Option[]>(() => {
    const byPath = new Map(entries.map((e) => [e.path, e]));
    const toOption = (e: SearchEntry, group: Option["group"]): Option => ({
      id: `${group}:${e.id ?? e.path}`,
      label: e.label,
      context: e.context,
      path: e.path,
      group,
      icon3d: e.icon3d,
      icon: e.icon,
    });

    const q = query.trim().toLowerCase();
    if (!q) {
      // Only recents that are still in this user's allowed entries.
      return recent
        .map((p) => byPath.get(p))
        .filter((e): e is SearchEntry => e !== undefined)
        .map((e) => toOption(e, "Recent"));
    }

    const words = q.split(/\s+/).filter(Boolean);
    const ranked = entries
      .map((e) => ({ e, s: score(e, words) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.e.label.localeCompare(b.e.label));
    const pages = ranked
      .filter((r) => r.e.kind === "page")
      .slice(0, MAX_PAGES)
      .map((r) => toOption(r.e, "Pages"));
    const actions = ranked
      .filter((r) => r.e.kind === "action")
      .slice(0, MAX_ACTIONS)
      .map((r) => toOption(r.e, "Actions"));
    const people =
      employeeLookup && debounced.length >= 2
        ? (employees.data?.data ?? []).map((emp): Option => ({
            id: `Employees:${emp.id}`,
            label: emp.fullName,
            context: `${emp.employeeCode} · ${emp.designation.name}`,
            path: `/hr/employees/${emp.id}`,
            group: "Employees",
            icon3d: undefined,
            icon: undefined,
          }))
        : [];
    return [...actions, ...pages, ...people];
  }, [entries, query, recent, employeeLookup, debounced, employees.data]);

  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const showList = open && (options.length > 0 || query.trim().length > 0);
  const lookingUp =
    employeeLookup &&
    query.trim().length >= 2 &&
    (debounced !== query.trim() || employees.isFetching);

  function choose(option: Option) {
    if (option.group !== "Employees") pushRecent(option.path);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(option.path);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        options.length ? (i - 1 + options.length) % options.length : 0,
      );
    } else if (e.key === "Enter") {
      const option = options[activeIndex];
      if (option) {
        e.preventDefault();
        choose(option);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`;
  let lastGroup: Option["group"] | null = null;

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
        <Search className="h-4 w-4" aria-hidden="true" />
      </span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search pages and people"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && options.length > 0 ? optionId(activeIndex) : undefined
        }
        placeholder="Search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onInputKey}
        className="peer h-9 w-full rounded-xl border border-slate-200/90 bg-white/90 pl-9 pr-14 text-xs text-slate-900 shadow-xs transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-[#1C2029] dark:bg-[#0D1117] dark:text-[#F8FAFC] dark:placeholder:text-gray-500"
      />
      <kbd className="pointer-events-none absolute inset-y-0 right-2 my-auto hidden h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-500 peer-focus:hidden lg:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Ctrl K
      </kbd>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="glass-dropdown absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[22rem] max-w-[90vw] overflow-y-auto rounded-2xl p-2 shadow-2xl"
        >
          {options.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {lookingUp ? "Searching…" : `No matches for "${query.trim()}"`}
            </li>
          ) : (
            options.map((option, i) => {
              const header =
                option.group !== lastGroup ? (
                  <li
                    key={`h-${option.group}`}
                    role="presentation"
                    className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:pt-1"
                  >
                    {option.group}
                  </li>
                ) : null;
              lastGroup = option.group;
              const Icon = option.icon ?? GROUP_ICON[option.group];
              const isActive = i === activeIndex;
              return [
                header,
                <li
                  key={option.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 ${
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    {option.icon3d ? (
                      <Semantic3DIcon name={option.icon3d} size={18} />
                    ) : (
                      <Icon className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {option.label}
                    </span>
                    {option.context ? (
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {option.context}
                      </span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>,
              ];
            })
          )}
          {lookingUp && options.length > 0 ? (
            <li
              role="presentation"
              className="px-3 py-1.5 text-[10px] text-slate-400"
            >
              Searching employees…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
