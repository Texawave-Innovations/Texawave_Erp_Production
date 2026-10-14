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
  type CreateSalaryBody,
  type DeclarationListQuery,
  type LoanPrepaymentBody,
  type PayrollSettingsBody,
  type PtSlabBody,
  type SalaryComponentBody,
  type SalaryListQuery,
  type SalaryTemplateBody,
  type SaveDeclarationBody,
  type TaxRegimeBody,
  type UpdateSalaryBody,
  type VerifyDeclarationBody,
  calculateStatutoryBonus,
  createGratuity,
  createPtSlab,
  createSalary,
  createSalaryComponent,
  createSalaryTemplate,
  decideLoan,
  requestMyLoan,
  reviewLoan,
  decideLoanPrepayment,
  getForm16,
  getGratuity,
  getPayrollSettings,
  listMyDeclarations,
  listPtLocationStates,
  listPtSlabs,
  listSalaries,
  listSalaryComponents,
  listSalaryTemplates,
  listTaxDeclarations,
  listTaxRegimes,
  previewSalaryTemplate,
  regeneratePayslip,
  reopenPeriod,
  requestLoanPrepayment,
  saveDeclarationForEmployee,
  saveMyDeclaration,
  saveTaxRegime,
  setPtLocationState,
  updatePayrollSettings,
  updatePtSlab,
  updateSalary,
  updateSalaryComponent,
  updateSalaryTemplate,
  verifyDeclaration,
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
  return useOrgScopedMutation(
    [KEY],
    (args: number | { payrollPeriodId: number; reason?: string }) =>
      typeof args === "number"
        ? generatePayslips(args)
        : generatePayslips(args.payrollPeriodId, args.reason),
  );
}

// ---- payments ------------------------------------------------------------

export function usePaymentBatches(query: BatchListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "payment-batches", query),
    queryFn: () => listPaymentBatches(query),
    enabled: orgId > 0 && enabled,
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

// ---- reopen, payslip regeneration ------------------------------------------

export function useReopenPeriod() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, reason }: { id: number; reason: string }) =>
      reopenPeriod(id, reason),
  );
}

export function useRegeneratePayslip() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, reason }: { id: number; reason: string }) =>
      regeneratePayslip(id, reason),
  );
}

// ---- settings & masters -------------------------------------------------------

export function usePayrollSettings(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "settings"),
    queryFn: getPayrollSettings,
    enabled: orgId > 0 && enabled,
  });
}

export function useUpdatePayrollSettings() {
  return useOrgScopedMutation([KEY], (body: PayrollSettingsBody) =>
    updatePayrollSettings(body),
  );
}

export function useSalaryComponents(includeInactive = false, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "components",
      includeInactive ? "all" : "active",
    ),
    queryFn: () => listSalaryComponents(includeInactive),
    enabled: orgId > 0 && enabled,
  });
}

export function useSaveSalaryComponent() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number | null; body: SalaryComponentBody }) =>
      id === null
        ? createSalaryComponent(body)
        : updateSalaryComponent(id, body),
  );
}

export function useSalaryTemplates(includeInactive = false, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "templates",
      includeInactive ? "all" : "active",
    ),
    queryFn: () => listSalaryTemplates(includeInactive),
    enabled: orgId > 0 && enabled,
  });
}

export function useSaveSalaryTemplate() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number | null; body: SalaryTemplateBody }) =>
      id === null ? createSalaryTemplate(body) : updateSalaryTemplate(id, body),
  );
}

export function useTemplatePreview(
  templateId: number | null,
  grossMonthly: number,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "template-preview",
      templateId ?? 0,
      grossMonthly,
    ),
    queryFn: () => previewSalaryTemplate(templateId as number, grossMonthly),
    enabled: orgId > 0 && Boolean(templateId) && grossMonthly > 0,
    retry: false,
  });
}

// ---- salaries -------------------------------------------------------------------

export function useSalaries(query: SalaryListQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "salaries", query),
    queryFn: () => listSalaries(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useCreateSalary() {
  return useOrgScopedMutation([KEY], (body: CreateSalaryBody) =>
    createSalary(body),
  );
}

export function useUpdateSalary() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UpdateSalaryBody }) =>
      updateSalary(id, body),
  );
}

// ---- tax regimes, Professional Tax ---------------------------------------------

export function useTaxRegimes(financialYear: string, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "tax-regimes", financialYear),
    queryFn: () => listTaxRegimes(financialYear),
    enabled: orgId > 0 && enabled,
  });
}

export function useSaveTaxRegime() {
  return useOrgScopedMutation([KEY], (body: TaxRegimeBody) =>
    saveTaxRegime(body),
  );
}

export function usePtSlabs(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "pt-slabs"),
    queryFn: listPtSlabs,
    enabled: orgId > 0 && enabled,
  });
}

export function useCreatePtSlab() {
  return useOrgScopedMutation([KEY], (body: PtSlabBody) => createPtSlab(body));
}

export function useUpdatePtSlab() {
  return useOrgScopedMutation(
    [KEY],
    ({
      id,
      body,
    }: {
      id: number;
      body: { effectiveTo?: string; isActive?: boolean };
    }) => updatePtSlab(id, body),
  );
}

export function usePtLocationStates(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "pt-location-states"),
    queryFn: listPtLocationStates,
    enabled: orgId > 0 && enabled,
  });
}

export function useSetPtLocationState() {
  return useOrgScopedMutation(
    [KEY],
    ({
      workLocationId,
      stateCode,
    }: {
      workLocationId: number;
      stateCode: string;
    }) => setPtLocationState(workLocationId, stateCode),
  );
}

// ---- tax declarations & Form 16 -------------------------------------------------

export function useTaxDeclarations(
  query: DeclarationListQuery,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "declarations", query),
    queryFn: () => listTaxDeclarations(query),
    enabled: orgId > 0 && enabled,
  });
}

export function useSaveDeclarationForEmployee() {
  return useOrgScopedMutation(
    [KEY],
    ({
      employeeId,
      financialYear,
      body,
    }: {
      employeeId: number;
      financialYear: string;
      body: SaveDeclarationBody;
    }) => saveDeclarationForEmployee(employeeId, financialYear, body),
  );
}

export function useVerifyDeclaration() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: VerifyDeclarationBody }) =>
      verifyDeclaration(id, body),
  );
}

export function useMyDeclarations(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "my-declarations"),
    queryFn: listMyDeclarations,
    enabled: orgId > 0 && enabled,
  });
}

export function useSaveMyDeclaration() {
  return useOrgScopedMutation(
    [KEY],
    ({
      financialYear,
      body,
    }: {
      financialYear: string;
      body: SaveDeclarationBody;
    }) => saveMyDeclaration(financialYear, body),
  );
}

/** `employeeId` null = the caller's own Form 16. */
export function useForm16(
  financialYear: string,
  employeeId: number | null,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(
      orgId,
      KEY,
      "form16",
      financialYear,
      employeeId ?? 0,
    ),
    queryFn: () => getForm16(financialYear, employeeId),
    enabled: orgId > 0 && enabled,
    retry: false,
  });
}

// ---- loans: approval & prepayments ---------------------------------------------

export function useRequestMyLoan() {
  return useOrgScopedMutation(
    [KEY],
    (body: Omit<CreateLoanBody, "employeeId">) => requestMyLoan(body),
  );
}

export function useReviewLoan() {
  return useOrgScopedMutation(
    [KEY],
    ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "FORWARD" | "REJECT";
      note?: string | undefined;
    }) => reviewLoan(id, { decision, ...(note ? { note } : {}) }),
  );
}

export function useDecideLoan() {
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
    }) => decideLoan(id, { decision, ...(note ? { note } : {}) }),
  );
}

export function useRequestLoanPrepayment() {
  return useOrgScopedMutation(
    [KEY],
    ({ loanId, body }: { loanId: number; body: LoanPrepaymentBody }) =>
      requestLoanPrepayment(loanId, body),
  );
}

export function useDecideLoanPrepayment() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, decision }: { id: number; decision: "APPROVED" | "REJECTED" }) =>
      decideLoanPrepayment(id, decision),
  );
}

// ---- statutory bonus & gratuity -------------------------------------------------

export function useStatutoryBonus() {
  return useOrgScopedMutation(
    [KEY],
    (body: { financialYear: string; create?: boolean }) =>
      calculateStatutoryBonus(body),
  );
}

export function useGratuity(
  employeeId: number | null,
  asOf: string,
  enabled = true,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "gratuity", employeeId ?? 0, asOf),
    queryFn: () => getGratuity(employeeId as number, asOf || undefined),
    enabled: orgId > 0 && Boolean(employeeId) && enabled,
    retry: false,
  });
}

export function useCreateGratuity() {
  return useOrgScopedMutation(
    [KEY],
    (body: {
      employeeId: number;
      asOf: string;
      payrollPeriodId?: number | undefined;
    }) => createGratuity(body),
  );
}
