/**
 * Statutory and accounting files built from a finalized payroll run — pure
 * formatting, no I/O (Docs/PAYROLL_AND_COMPLIANCE.md §4.15).
 */
import { csvCell } from "../shared/sensitive-data.js";

/** Byte-order mark: lets spreadsheet programs read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const rupee = (v: number) => Math.round(v + Number.EPSILON);

export interface EcrRow {
  uan: string;
  name: string;
  grossWage: number;
  pfWage: number;
  epsWage: number;
  edliWage: number;
  employeeContribution: number;
  epsContribution: number;
  epfEmployerContribution: number;
  ncpDays: number;
}

/**
 * EPFO ECR (version 2) text: one member per line, fields separated by
 * `#~#`, whole rupees: UAN, name, gross wages, EPF wages, EPS wages, EDLI
 * wages, EPF contribution (employee), EPS contribution, EPF–EPS difference
 * (employer), NCP days, refund of advances.
 */
export function ecrText(rows: readonly EcrRow[]): string {
  return rows
    .map((r) =>
      [
        r.uan,
        r.name.replace(/#~#|[\r\n]/g, " ").toUpperCase(),
        rupee(r.grossWage),
        rupee(r.pfWage),
        rupee(r.epsWage),
        rupee(r.edliWage),
        rupee(r.employeeContribution),
        rupee(r.epsContribution),
        rupee(r.epfEmployerContribution),
        Math.round(r.ncpDays),
        0,
      ].join("#~#"),
    )
    .join("\n");
}

/** CSV with a UTF-8 BOM (so spreadsheet programs read ₹ and names right),
 * every cell quoted and formula-neutralised. */
export function csv(
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
): string {
  return (
    BOM +
    [header, ...rows]
      .map((r) => r.map((c) => csvCell(c)).join(","))
      .join("\r\n")
  );
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface JournalInput {
  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  employerPf: number;
  employerEdli: number;
  pfAdmin: number;
  employerEsi: number;
  netPayable: number;
}

/**
 * The month's salary journal: expenses debited (each earning, employer PF /
 * EDLI / admin, employer ESI); liabilities credited (each deduction,
 * PF and ESI including the employer share, net salary payable). Balanced by
 * construction. Ledger names are component codes; mapping them to the
 * chart of accounts is Finance's.
 */
export function salaryJournal(input: JournalInput): JournalLine[] {
  const byKey = new Map<string, JournalLine>();
  const add = (account: string, debit: number, credit: number) => {
    const line = byKey.get(account) ?? { account, debit: 0, credit: 0 };
    line.debit += debit;
    line.credit += credit;
    byKey.set(account, line);
  };
  for (const e of input.earnings) add(`Salary expense: ${e.code}`, e.amount, 0);
  if (input.employerPf > 0) add("Employer PF expense", input.employerPf, 0);
  if (input.employerEdli > 0)
    add("Employer EDLI expense", input.employerEdli, 0);
  if (input.pfAdmin > 0) add("PF admin charges expense", input.pfAdmin, 0);
  if (input.employerEsi > 0) add("Employer ESI expense", input.employerEsi, 0);

  for (const d of input.deductions) {
    const account =
      d.code === "PF"
        ? "PF payable"
        : d.code === "ESI"
          ? "ESI payable"
          : d.code === "PT"
            ? "Professional Tax payable"
            : d.code === "TDS"
              ? "TDS payable"
              : d.code === "LOAN"
                ? "Employee loans (recovery)"
                : `Deduction payable: ${d.code}`;
    add(account, 0, d.amount);
  }
  if (input.employerPf + input.employerEdli + input.pfAdmin > 0) {
    add("PF payable", 0, input.employerPf + input.employerEdli + input.pfAdmin);
  }
  if (input.employerEsi > 0) add("ESI payable", 0, input.employerEsi);
  add("Net salary payable", 0, input.netPayable);

  const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  return [...byKey.values()].map((l) => ({
    account: l.account,
    debit: r2(l.debit),
    credit: r2(l.credit),
  }));
}
