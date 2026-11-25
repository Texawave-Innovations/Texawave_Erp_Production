"use client";

import { useState } from "react";
import { resolveMessage, type MessageKey } from "@texawave-erp/core";
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

/** An error's own message (SCM views rethrow the API's message as a plain
 * `Error`), else the catalogue wording for `fallback`. */
export function errorText(err: unknown, fallback: MessageKey): string {
  return err instanceof Error && err.message
    ? err.message
    : resolveMessage(fallback).title;
}
