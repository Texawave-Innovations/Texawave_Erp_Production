/**
 * Bank account and PAN numbers are never returned in full from a JSON
 * endpoint — only the last four characters. The one place a full account
 * number leaves the API is the bank-transfer CSV export, because the bank
 * needs it to pay.
 *
 * Payroll does not own bank details: it reads the onboarding record
 * (`hr.employee_bank_details`, account number encrypted at rest with a
 * stored masked copy) and PAN from `hr.employee_government_ids`. Responses
 * keep payroll's `employee.bankDetails` shape so API consumers are unchanged.
 */
export function maskTail(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

interface BankDetailSource {
  bankName: string;
  accountNumberMasked: string;
  ifsc: string;
  deletedAt: Date | null;
}

interface GovernmentIdSource {
  panNumber: string | null;
  deletedAt: Date | null;
}

export interface PayrollBankView {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber?: string | null;
}

type WithBankSource = {
  bankDetail?: BankDetailSource | null;
  employeeGovernmentId?: GovernmentIdSource | null;
};

/** Replaces the onboarding `bankDetail` / `employeeGovernmentId` relations on
 * an employee with a masked `bankDetails` view; soft-deleted rows count as
 * missing. PAN is only included when the government-id row was selected. */
export function toPayrollBankView<E extends WithBankSource>(
  employee: E,
): Omit<E, "bankDetail" | "employeeGovernmentId"> & {
  bankDetails: PayrollBankView | null;
} {
  const { bankDetail, employeeGovernmentId, ...rest } = employee;
  const bank = bankDetail && !bankDetail.deletedAt ? bankDetail : null;
  const govId =
    employeeGovernmentId && !employeeGovernmentId.deletedAt
      ? employeeGovernmentId
      : null;
  return {
    ...rest,
    bankDetails: bank
      ? {
          bankName: bank.bankName,
          accountNumber: bank.accountNumberMasked,
          ifscCode: bank.ifsc,
          ...(employeeGovernmentId !== undefined
            ? { panNumber: maskTail(govId?.panNumber) }
            : {}),
        }
      : null,
  };
}

/** Applies `toPayrollBankView` to any row shaped `{ employee: {...} }`. */
export function maskEmployeeBankDetails<T extends { employee: WithBankSource }>(
  row: T,
): Omit<T, "employee"> & {
  employee: ReturnType<typeof toPayrollBankView<T["employee"]>>;
} {
  return { ...row, employee: toPayrollBankView(row.employee) };
}

/**
 * One CSV cell: always quoted, embedded quotes doubled, and a leading
 * `= + - @` (or tab/CR) neutralised with a `'` so a spreadsheet never
 * evaluates an employee name or bank name as a formula (CSV injection).
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
