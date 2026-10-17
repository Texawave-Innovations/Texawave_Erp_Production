"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  convertQuotation,
  createQuotation,
  deleteQuotation,
  getNextQuotationNumber,
  getQuotation,
  listQuotations,
  updateQuotation,
  type QuotationListQuery,
} from "./api";
import type { QuotationBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useQuotations(query: QuotationListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "quotations", "list", query),
    queryFn: () => listQuotations(query),
    enabled: orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useQuotation(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "quotations", "detail", id ?? 0),
    queryFn: () => getQuotation(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useNextQuotationNumber(date: string, enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "quotations", "next", date),
    queryFn: () => getNextQuotationNumber(date),
    enabled: enabled && orgId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date),
  });
}

export function useCreateQuotation() {
  return useOrgScopedMutation([SALES_KEY], (body: QuotationBody) =>
    createQuotation(body),
  );
}

export function useUpdateQuotation() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: QuotationBody }) =>
      updateQuotation(id, body),
  );
}

export function useDeleteQuotation() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteQuotation(id));
}

export function useConvertQuotation() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({
      id,
      body,
    }: {
      id: number;
      body: { invoiceType: "PROFORMA" | "TAX"; invoiceDate: string };
    }) => convertQuotation(id, body),
  );
}
