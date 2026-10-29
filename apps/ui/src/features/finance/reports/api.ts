import type {
  FinanceBalanceSheetReport,
  FinanceProfitAndLossReport,
  FinanceTrialBalanceReport,
  GeneralLedgerAccountReport,
  QueryBalanceSheetInput,
  QueryGeneralLedgerInput,
  QueryProfitAndLossInput,
  QueryTrialBalanceInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch Balance Sheet snapshot statement */
export async function getBalanceSheet(
  query: QueryBalanceSheetInput = {},
): Promise<FinanceBalanceSheetReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceBalanceSheetReport>("/finance/reports/balance-sheet", {
      query,
    }),
  );
  return data;
}

/** Fetch Profit & Loss performance statement */
export async function getProfitAndLoss(
  query: QueryProfitAndLossInput = {},
): Promise<FinanceProfitAndLossReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceProfitAndLossReport>(
      "/finance/reports/profit-and-loss",
      { query },
    ),
  );
  return data;
}

/** Fetch Trial Balance summarizing debit and credit movements across all accounts */
export async function getTrialBalance(
  query: QueryTrialBalanceInput = {},
): Promise<FinanceTrialBalanceReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinanceTrialBalanceReport>("/finance/reports/trial-balance", {
      query,
    }),
  );
  return data;
}

/** Fetch account-level General Ledger statement with running balance */
export async function getGeneralLedger(
  query: QueryGeneralLedgerInput = {},
): Promise<GeneralLedgerAccountReport> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<GeneralLedgerAccountReport>(
      "/finance/reports/general-ledger",
      { query },
    ),
  );
  return data;
}
