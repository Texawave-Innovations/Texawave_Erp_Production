import type { Prisma } from "@texawave-erp/database";
import { toRules } from "../settings/payroll-settings.rules.js";
import { maskEmployeeBankDetails } from "./sensitive-data.js";

/**
 * The frozen content of a payslip (Docs/PAYROLL_AND_COMPLIANCE.md §6): the
 * employee's masked details, the period, every earning and deduction line,
 * and the employer details, all captured when the payslip is generated. The
 * PDF is rendered from this, never from live rows, so a later change to the
 * employee, their bank or the company never alters an issued payslip.
 */
export interface PayslipSnapshot {
  netPayable: string;
  employee: {
    employeeCode: string;
    fullName: string;
    designation: { name: string } | null;
    department: { name: string } | null;
    pfProfile: { uan: string | null; pfNumber: string | null } | null;
    esiProfile: { insuranceNumber: string | null } | null;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      panNumber?: string | null;
    } | null;
  };
  payrollPeriod: { year: number; month: number };
  payrollEntry: {
    totalCalendarDays: number;
    payableDays: string;
    lopDays: string;
    totalGrossEarnings: string;
    totalDeductions: string;
    earnings: Array<{ code: string; name: string; calculatedAmount: string }>;
    deductions: Array<{ code: string; name: string; amount: string }>;
  };
  company: {
    name: string | null;
    address: string | null;
    gstin: string | null;
  };
}

const ENTRY_INCLUDE = {
  employee: {
    select: {
      employeeCode: true,
      fullName: true,
      designation: { select: { name: true } },
      department: { select: { name: true } },
      bankDetail: {
        select: {
          bankName: true,
          accountNumberMasked: true,
          ifsc: true,
          deletedAt: true,
        },
      },
      employeeGovernmentId: { select: { panNumber: true, deletedAt: true } },
      pfProfile: { select: { uan: true, pfNumber: true } },
      esiProfile: { select: { insuranceNumber: true } },
    },
  },
  payrollRun: {
    select: { payrollPeriod: { select: { year: true, month: true } } },
  },
  earnings: {
    where: { deletedAt: null },
    select: { code: true, name: true, calculatedAmount: true },
    orderBy: { id: "asc" },
  },
  deductions: {
    where: { deletedAt: null },
    select: { code: true, name: true, amount: true },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.PayrollEntryInclude;

/** Builds the snapshot of each entry (keyed by entry id). Runs inside the
 * generating transaction, so the snapshot matches what was finalized. */
export async function buildPayslipSnapshots(
  tx: Prisma.TransactionClient,
  organizationId: number,
  entryIds: number[],
): Promise<Map<number, PayslipSnapshot>> {
  const out = new Map<number, PayslipSnapshot>();
  if (entryIds.length === 0) return out;
  const rules = toRules(
    await tx.payrollSetting.findUnique({ where: { organizationId } }),
  );
  const entries = await tx.payrollEntry.findMany({
    where: { organizationId, id: { in: entryIds } },
    include: ENTRY_INCLUDE,
  });
  for (const e of entries) {
    const { employee } = maskEmployeeBankDetails({ employee: e.employee });
    out.set(e.id, {
      netPayable: e.netPayable.toString(),
      employee: {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        designation: employee.designation,
        department: employee.department,
        pfProfile: employee.pfProfile,
        esiProfile: employee.esiProfile,
        bankDetails: employee.bankDetails,
      },
      payrollPeriod: e.payrollRun.payrollPeriod,
      payrollEntry: {
        totalCalendarDays: e.totalCalendarDays,
        payableDays: e.payableDays.toString(),
        lopDays: e.lopDays.toString(),
        totalGrossEarnings: e.totalGrossEarnings.toString(),
        totalDeductions: e.totalDeductions.toString(),
        earnings: e.earnings.map((x) => ({
          code: x.code,
          name: x.name,
          calculatedAmount: x.calculatedAmount.toString(),
        })),
        deductions: e.deductions.map((x) => ({
          code: x.code,
          name: x.name,
          amount: x.amount.toString(),
        })),
      },
      company: {
        name: rules.companyName,
        address: rules.companyAddress,
        gstin: rules.companyGstin,
      },
    });
  }
  return out;
}

/** JSON with object keys sorted at every level. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Same content? Compared key-order-independently: PostgreSQL `jsonb`
 * stores object keys in its own order. */
export function sameSnapshot(a: unknown, b: PayslipSnapshot): boolean {
  return canonical(a) === canonical(b);
}
