"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/**
 * The live preview of a Sales document form: 600 ms after the values stop
 * changing, and only while they are valid, ask the server for the preview.
 * The last good preview stays shown (`fresh` false) until the next arrives;
 * a refused request keeps it and reports why. Late answers for older values
 * are ignored.
 */
export function useLivePreview<V, P>(
  values: V,
  isValid: (v: V) => boolean,
  request: (v: V) => Promise<P>,
) {
  const debounced = useDebouncedValue(values, 600);
  const key = JSON.stringify(debounced);
  const valid = isValid(debounced);
  const [result, setResult] = useState<{
    key: string;
    preview: P | null;
    error: string | null;
  } | null>(null);
  const [last, setLast] = useState<P | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!valid) return;
    const mine = ++seq.current;
    request(debounced)
      .then((p) => {
        if (mine !== seq.current) return;
        setLast(p);
        setResult({ key, preview: p, error: null });
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        setResult({
          key,
          preview: null,
          error:
            e instanceof ApiError ? e.message : "The preview could not load.",
        });
      });
  }, [debounced, key, valid, request]);

  const settled = result?.key === key;
  return {
    preview: last,
    /** The preview matches the values on screen right now. */
    fresh:
      last !== null &&
      result?.preview === last &&
      result.key === JSON.stringify(values),
    loading: valid && !settled,
    error: settled ? (result?.error ?? null) : null,
  };
}
