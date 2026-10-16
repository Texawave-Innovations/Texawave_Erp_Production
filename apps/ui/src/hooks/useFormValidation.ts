"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";

/** A zod issue path → the form's error key (`addresses.0.city`). */
export function issueKey(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

type Errors = Partial<Record<string, string>>;

function collectErrors(result: { success: boolean; error?: z.ZodError }) {
  const errors: Errors = {};
  if (!result.success && result.error) {
    for (const issue of result.error.issues) {
      const key = issueKey(issue.path);
      errors[key] ??= issue.message;
    }
  }
  return errors;
}

/**
 * Field-by-field validation for any form with a zod schema:
 * - a field's error shows once the user has left it (`touch`), or after a
 *   submit attempt (`validateAll`), and updates live while they fix it;
 * - cross-field rules (`superRefine`) show on the field they point at;
 * - `serverErrors` (e.g. a duplicate GSTIN from the API) are shown on their
 *   field until the user changes that field.
 *
 * Pair it with `<FormField errorVariant="bubble" error={errorFor("x")}>`.
 * The schema is re-run on every change (cheap for form-sized data).
 */
export function useFormValidation<S extends z.ZodType>(
  schema: S,
  values: z.input<S>,
) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrorsState] = useState<Errors>({});

  const allErrors = useMemo(
    () => collectErrors(schema.safeParse(values)),
    [schema, values],
  );

  const errorFor = useCallback(
    (key: string): string | undefined => {
      if (serverErrors[key]) return serverErrors[key];
      if (!submitted && !touched.has(key)) return undefined;
      return allErrors[key];
    },
    [allErrors, serverErrors, submitted, touched],
  );

  // A field left by pressing the mouse elsewhere (e.g. on Save) shows its
  // error only after the button is released: showing it at once would push
  // the layout down mid-click, and the click would miss the moved button.
  const pointerDown = useRef(false);
  const pending = useRef<string[]>([]);
  const markTouched = useCallback((keys: readonly string[]) => {
    setTouched((prev) => {
      const fresh = keys.filter((k) => !prev.has(k));
      return fresh.length ? new Set([...prev, ...fresh]) : prev;
    });
  }, []);
  useEffect(() => {
    const down = () => {
      pointerDown.current = true;
    };
    const up = () => {
      pointerDown.current = false;
      // After this click has been delivered.
      setTimeout(() => {
        const keys = pending.current;
        pending.current = [];
        if (keys.length) markTouched(keys);
      }, 0);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
    };
  }, [markTouched]);

  /** Mark a field as left (call from `onBlur`). */
  const touch = useCallback(
    (key: string) => {
      if (pointerDown.current) pending.current.push(key);
      else markTouched([key]);
    },
    [markTouched],
  );

  /** Clear the server's error on a field the user just changed. */
  const changed = useCallback((key: string) => {
    setServerErrorsState((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** On submit: shows every error; returns the parsed data or null. */
  const validateAll = useCallback((): z.output<S> | null => {
    setSubmitted(true);
    const result = schema.safeParse(values);
    return result.success ? (result.data as z.output<S>) : null;
  }, [schema, values]);

  const setServerErrors = useCallback((errors: Errors) => {
    setServerErrorsState(errors);
  }, []);

  const reset = useCallback(() => {
    setTouched(new Set());
    setSubmitted(false);
    setServerErrorsState({});
  }, []);

  const hasErrors =
    Object.keys(allErrors).length > 0 || Object.keys(serverErrors).length > 0;

  return {
    errorFor,
    touch,
    changed,
    validateAll,
    setServerErrors,
    reset,
    hasErrors,
  };
}
