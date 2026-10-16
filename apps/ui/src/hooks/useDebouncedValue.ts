"use client";

import { useEffect, useState } from "react";

/** Debounces free-text search so each keystroke does not hit the API. Same
 * behaviour as the copies in features/hr/employees/hooks.ts and
 * features/hr/recruitment/utils.ts, which can move here later. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
