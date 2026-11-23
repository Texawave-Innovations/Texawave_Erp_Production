"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../shared/query";
import {
  convertToTax,
  createChallanFromInvoice,
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  markProformaConverted,
  reopenProforma,
  updateInvoice,
  type InvoiceListQuery,
} from "./api";
import type { InvoiceBody, InvoiceUpdateBody } from "./types";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useInvoices(query: InvoiceListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "invoices", "list", query),
    queryFn: () => listInvoices(query),
    enabled: enabled && orgId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "invoices", "detail", id ?? 0),
    queryFn: () => getInvoice(id as number),
    enabled: orgId > 0 && id !== null,
  });
}

export function useCreateInvoice() {
  return useOrgScopedMutation([SALES_KEY], (body: InvoiceBody) =>
    createInvoice(body),
  );
}

export function useUpdateInvoice() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, body }: { id: number; body: InvoiceUpdateBody }) =>
      updateInvoice(id, body),
  );
}

export function useDeleteInvoice() {
  return useOrgScopedMutation([SALES_KEY], (id: number) => deleteInvoice(id));
}

export function useConvertToTax() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, invoiceDate }: { id: number; invoiceDate: string }) =>
      convertToTax(id, invoiceDate),
  );
}

export function useMarkProformaConverted() {
  return useOrgScopedMutation([SALES_KEY], (id: number) =>
    markProformaConverted(id),
  );
}

export function useReopenProforma() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, reason }: { id: number; reason: string }) =>
      reopenProforma(id, reason),
  );
}

export function useCreateChallanFromInvoice() {
  return useOrgScopedMutation(
    [SALES_KEY],
    ({ id, dcDate }: { id: number; dcDate: string }) =>
      createChallanFromInvoice(id, dcDate),
  );
}
