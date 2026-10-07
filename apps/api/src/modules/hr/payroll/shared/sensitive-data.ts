/**
 * Bank account, PAN and Aadhaar numbers are never returned in full from a
 * JSON endpoint — only the last four characters. The one place a full
 * account number leaves the API is the bank-transfer CSV export, because the
 * bank needs it to pay. (Encryption at rest is tracked separately in
 * Docs/PAYROLL_AND_COMPLIANCE.md "Data protection".)
 */
export function maskTail(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

interface BankDetailsLike {
  accountNumber?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
}

export function maskBankDetails<T extends BankDetailsLike | null | undefined>(
  bank: T,
): T {
  if (!bank) return bank;
  return {
    ...bank,
    ...("accountNumber" in bank
      ? { accountNumber: maskTail(bank.accountNumber) }
      : {}),
    ...("panNumber" in bank ? { panNumber: maskTail(bank.panNumber) } : {}),
    ...("aadhaarNumber" in bank
      ? { aadhaarNumber: maskTail(bank.aadhaarNumber) }
      : {}),
  };
}

/** Masks `employee.bankDetails` on any row shaped `{ employee: { bankDetails } }`. */
export function maskEmployeeBankDetails<
  T extends { employee: { bankDetails?: BankDetailsLike | null } },
>(row: T): T {
  return {
    ...row,
    employee: {
      ...row.employee,
      bankDetails: maskBankDetails(row.employee.bankDetails),
    },
  };
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
