"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Search } from "lucide-react";
import { Button, Card, Checkbox, Input } from "@texawave-erp/ui-kit";
import {
  levelOf,
  withLevel,
  type AccessSection,
  type Level,
} from "../utils/access-model";
import { ScopeControl } from "./ScopeControl";

/**
 * The role's permissions, grouped by area → resource → action. Edits update
 * the caller's draft grant set; nothing is saved here.
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
  const [query, setQuery] = useState("");
  const [grantedOnly, setGrantedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        resources: s.resources
          .map((r) => ({
            ...r,
            actions: r.actions.filter(
              (a) =>
                (!grantedOnly || levelOf(a, draft) !== "none") &&
                (needle === "" ||
                  r.label.toLowerCase().includes(needle) ||
                  a.label.toLowerCase().includes(needle) ||
                  a.description.toLowerCase().includes(needle) ||
                  a.code.includes(needle)),
            ),
          }))
          .filter((r) => r.actions.length > 0),
      }))
      .filter((s) => s.resources.length > 0);
  }, [sections, query, grantedOnly, draft]);

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearSection(section: AccessSection) {
    const next = new Set(draft);
    for (const id of section.permissionIds) next.delete(id);
    onChange(next);
  }

  const searching = query.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Input
            type="search"
            aria-label="Search permissions"
            placeholder="Search permissions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <label className="inline-flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={grantedOnly}
            onChange={(e) => setGrantedOnly(e.target.checked)}
          />
          Show granted only
        </label>
      </div>

      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold">Own</span> = the user's own records ·{" "}
        <span className="font-semibold">Team</span> = records of the teams
        assigned to the user · <span className="font-semibold">All</span> =
        every team. A lock means the system never allows that scope.
      </p>

      {visible.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-theme-sm text-gray-500">
            No permissions match.
          </p>
        </Card>
      ) : null}

      {visible.map((section) => {
        const full = sections.find((s) => s.key === section.key)!;
        const grantedCount = full.resources.reduce(
          (n, r) =>
            n + r.actions.filter((a) => levelOf(a, draft) !== "none").length,
          0,
        );
        const total = full.resources.reduce((n, r) => n + r.actions.length, 0);
        const open = searching || !collapsed.has(section.key);
        return (
          <Card key={section.key} className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleSection(section.key)}
                className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                    {section.label}
                  </span>
                  <span className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                    {section.description}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-theme-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {grantedCount}/{total}
                </span>
                {!readOnly && grantedCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => clearSection(full)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            {open ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {section.resources.map((resource) => (
                  <li
                    key={resource.key}
                    className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-start lg:gap-6"
                  >
                    <div className="w-full shrink-0 lg:w-56">
                      <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">
                        {resource.label}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-x-6 gap-y-3">
                      {resource.actions.map((action) => {
                        const level = levelOf(action, draft);
                        const changed = level !== levelOf(action, baseline);
                        return (
                          <div
                            key={action.code}
                            className="flex flex-col gap-1"
                          >
                            <span className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
                              {action.label}
                              {action.sensitive ? (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-warning-600"
                                  aria-label="Sensitive permission"
                                />
                              ) : null}
                              {changed ? (
                                <span className="rounded bg-warning-100 px-1 text-[10px] font-semibold text-warning-800 dark:bg-warning-950 dark:text-warning-300">
                                  changed
                                </span>
                              ) : null}
                            </span>
                            <ScopeControl
                              action={action}
                              level={level}
                              disabled={readOnly}
                              labelPrefix={resource.label}
                              onChange={(next: Level) =>
                                onChange(withLevel(action, draft, next))
                              }
                            />
                            <span className="max-w-64 text-[11px] leading-snug text-gray-400">
                              {action.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
