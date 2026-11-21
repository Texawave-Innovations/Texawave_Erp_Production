"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** What a half-filled form has picked so far (empty values are dropped). */
export type DraftParams = Record<string, string | number | null | undefined>;

/** The query of a draft preview: only the values that are filled in. */
export function cleanDraftParams(
  params: DraftParams,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

/**
 * The HTML of a Sales form's draft preview: the empty document with what the
 * user has picked so far (customer, date, header fields), fetched when the
 * form opens and again 300 ms after those values change. Used until the first
 * valid preview takes over. The last HTML stays shown while the next loads.
 * Best effort: a refused request (a date half typed, say) keeps what is shown;
 * with no HTML at all the panel shows its empty message.
 *
 * `load` must be stable; pass `undefined` to skip fetching.
 */
export function useTemplateHtml(
  load:
    | ((params: Record<string, string | number>) => Promise<{ html: string }>)
    | undefined,
  params: DraftParams,
): string | null {
  const [html, setHtml] = useState<string | null>(null);
  // Debounce the serialised params: an object would change identity every render.
  const key = useDebouncedValue(JSON.stringify(cleanDraftParams(params)), 300);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    load(JSON.parse(key) as Record<string, string | number>)
      .then((t) => {
        if (!cancelled) setHtml(t.html);
      })
      .catch(() => {
        /* keep what is shown */
      });
    return () => {
      cancelled = true;
    };
  }, [load, key]);

  return html;
}
