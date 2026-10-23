"use client";

import { useState } from "react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";

/** Page + debounced search state every SCM list shares. */
export function useListControls(pageSize = 10) {
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState("");
  const debounced = useDebouncedValue(search.trim(), 250);
  return {
    page,
    setPage,
    pageSize,
    search,
    setSearch: (value: string) => {
      setSearchRaw(value);
      setPage(1);
    },
    q: debounced || undefined,
  };
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
