"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import {
  approveRun,
  cancelPeriod,
  type CreatePeriodBody,
  type CreateRunBody,
  createPeriod,
  createRun,
  type EntryListQuery,
  finalizePeriod,
  getEntry,
  getPeriod,
  listAllRunEntries,
  listEntries,
  listPeriods,
  listRuns,
  type PeriodListQuery,
  type RunListQuery,
  type BonusListQuery,
  type ContributionQuery,
  type CreateBonusBody,
  type CreateLoanBody,
  type LoanListQuery,
  createBonus,
  createLoan,
  decideBonus,
  decideLoanSkip,
  type EsiProfileBody,
  getComplianceProfile,
  listBonuses,
  listContributions,
  listLoans,
  listMyLoans,
  type PfProfileBody,
  requestLoanSkip,
  saveComplianceProfile,
  type BatchListQuery,
  type PayslipListQuery,
  type UpdatePaymentBody,
  createPaymentBatch,
  generatePayslips,
  getPaymentBatch,
  listMyPayslips,
  listPaymentBatches,
  listPayslips,
  processPaymentBatch,
  updatePayment,
} from "./api";
import type { ComplianceKind, PaymentMethod } from "./types";

/** One root for every payroll query: a period/run change also changes runs,
 * entries and payslips, so mutations invalidate the whole subtree. */
const KEY = "hr-payroll" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

// ---- periods --------------------------------------------------------------

export function usePeriods(query: PeriodListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "periods", query),
    queryFn: () => listPeriods(query),
    enabled: orgId > 0 && enabled,
  });
}

export function usePeriod(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "period", id ?? 0),
    queryFn: () => getPeriod(id as number),
    enabled: orgId > 0 && Boolean(id),
  });
}

export function useCreatePeriod() {
  return useOrgScopedMutation([KEY], (body: CreatePeriodBody) =>
    createPeriod(body),
  );
}

export function useCancelPeriod() {
  return useOrgScopedMutation([KEY], (id: number) => cancelPeriod(id));
}

export function useFinalizePeriod() {
  return useOrgScopedMutation([KEY], (id: number) => finalizePeriod(id));
}

// ---- runs -----------------------------------------------------------------

export function useRuns(query: RunListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "runs", query),
    queryFn: () => listRuns(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateRun() {
  return useOrgScopedMutation([KEY], (body: CreateRunBody) => createRun(body));
}

export function useApproveRun() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, notes }: { id: number; notes?: string }) =>
      approveRun(id, notes ? { notes } : {}),
  );
}

// ---- entries --------------------------------------------------------------

export function useEntries(query: EntryListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "entries", query),
    queryFn: () => listEntries(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useEntry(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "entry", id ?? 0),
    queryFn: () => getEntry(id as number),
    enabled: orgId > 0 && Boolean(id),
  });
}

export function useAllRunEntries(runId: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "run-entries-all", runId ?? 0),
    queryFn: () => listAllRunEntries(runId as number),
    enabled: orgId > 0 && Boolean(runId),
  });
}

// ---- compliance: PF / ESI ------------------------------------------------

export function useComplianceProfile(
  kind: ComplianceKind,
  employeeId: number | null,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, kind, "profile", employeeId ?? 0),
    queryFn: () => getComplianceProfile(kind, employeeId as number),
    enabled: orgId > 0 && Boolean(employeeId),
  });
}

export function useSaveComplianceProfile(kind: ComplianceKind) {
  return useOrgScopedMutation(
    [KEY],
    ({
      employeeId,
      body,
    }: {
      employeeId: number;
      body: PfProfileBody | EsiProfileBody;
    }) =>
      saveComplianceProfile(
        kind,
        employeeId,
        body as PfProfileBody & EsiProfileBody,
      ),
  );
}

export function useContributions(
  kind: ComplianceKind,
  query: ContributionQuery,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, kind, "contributions", query),
    queryFn: () => listContributions(kind, query),
    enabled: orgId > 0,
  });
}

// ---- loans ---------------------------------------------------------------

export function useLoans(query: LoanListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "loans", query),
    queryFn: () => listLoans(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useMyLoans(
  query: Omit<LoanListQuery, "employeeId">,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "my-loans", query),
    queryFn: () => listMyLoans(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateLoan() {
  return useOrgScopedMutation([KEY], (body: CreateLoanBody) =>
    createLoan(body),
  );
}

export function useRequestLoanSkip() {
  return useOrgScopedMutation(
    [KEY],
    ({
      loanId,
      body,
    }: {
      loanId: number;
      body: { payrollPeriodId: number; reason: string };
    }) => requestLoanSkip(loanId, body),
  );
}

export function useDecideLoanSkip() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, decision }: { id: number; decision: "APPROVED" | "REJECTED" }) =>
      decideLoanSkip(id, decision),
  );
}

// ---- bonuses -------------------------------------------------------------

export function useBonuses(query: BonusListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "bonuses", query),
    queryFn: () => listBonuses(query),
    enabled: orgId > 0,
  });
}

export function useCreateBonus() {
  return useOrgScopedMutation([KEY], (body: CreateBonusBody) =>
    createBonus(body),
  );
}

export function useDecideBonus() {
  return useOrgScopedMutation(
    [KEY],
    ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "APPROVED" | "REJECTED";
      note?: string | undefined;
    }) => decideBonus(id, { decision, ...(note ? { note } : {}) }),
  );
}

// ---- payslips ------------------------------------------------------------

export function usePayslips(query: PayslipListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "payslips", query),
    queryFn: () => listPayslips(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useMyPayslips(
  query: Omit<PayslipListQuery, "employeeId">,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "my-payslips", query),
    queryFn: () => listMyPayslips(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useGeneratePayslips() {
  return useOrgScopedMutation([KEY], (payrollPeriodId: number) =>
    generatePayslips(payrollPeriodId),
  );
}

// ---- payments ------------------------------------------------------------

export function usePaymentBatches(query: BatchListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "payment-batches", query),
    queryFn: () => listPaymentBatches(query),
    enabled: orgId > 0,
  });
}

export function usePaymentBatch(id: number | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "payment-batch", id ?? 0),
    queryFn: () => getPaymentBatch(id as number),
    enabled: orgId > 0 && Boolean(id),
  });
}

export function useCreatePaymentBatch() {
  return useOrgScopedMutation(
    [KEY],
    (body: { payrollPeriodId: number; paymentMethod: PaymentMethod }) =>
      createPaymentBatch(body),
  );
}

export function useProcessPaymentBatch() {
  return useOrgScopedMutation([KEY], (id: number) => processPaymentBatch(id));
}

export function useUpdatePayment() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UpdatePaymentBody }) =>
      updatePayment(id, body),
  );
}
