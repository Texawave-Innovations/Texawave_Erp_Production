"use client";

import type {
  QueryBalanceSheetInput,
  QueryGeneralLedgerInput,
  QueryProfitAndLossInput,
  QueryTrialBalanceInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  getBalanceSheet,
  getGeneralLedger,
  getProfitAndLoss,
  getTrialBalance,
} from "./api";

export function useBalanceSheet(
  query: QueryBalanceSheetInput = {},
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-reports-balance-sheet",
      query,
    ),
    queryFn: () => getBalanceSheet(query),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useProfitAndLoss(
  query: QueryProfitAndLossInput = {},
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-reports-profit-and-loss",
      query,
    ),
    queryFn: () => getProfitAndLoss(query),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useTrialBalance(
  query: QueryTrialBalanceInput = {},
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-reports-trial-balance",
      query,
    ),
    queryFn: () => getTrialBalance(query),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useGeneralLedgerReport(
  query: QueryGeneralLedgerInput = {},
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "finance-reports-general-ledger",
      query,
    ),
    queryFn: () => getGeneralLedger(query),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}
