/**
 * Turning a salary template into an employee's lines — pure, no I/O.
 * Docs/PAYROLL_AND_COMPLIANCE.md §3.0.
 *
 * Earning lines are worked out in this order: FIXED and PERCENT_OF_GROSS,
 * then PERCENT_OF_BASIC (of the BASIC line just computed), then the single
 * REMAINDER line takes gross minus every other earning. Deduction lines are
 * FIXED or a percent and never take part in the remainder.
 */
export const CALCULATION_TYPES = [
  "FIXED",
  "PERCENT_OF_GROSS",
  "PERCENT_OF_BASIC",
  "REMAINDER",
] as const;
export type CalculationType = (typeof CALCULATION_TYPES)[number];

export interface TemplateLine {
  componentId: number;
  code: string;
  kind: "EARNING" | "DEDUCTION";
  calculationType: CalculationType;
  value: number;
}

export interface AppliedLine {
  componentId: number;
  code: string;
  kind: "EARNING" | "DEDUCTION";
  monthlyAmount: number;
}

export class TemplateRuleError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TEMPLATE_EXCEEDS_GROSS"
      | "TEMPLATE_GROSS_MISMATCH"
      | "TEMPLATE_BASIC_MISSING",
  ) {
    super(message);
  }
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function applyTemplate(
  lines: readonly TemplateLine[],
  grossMonthly: number,
): AppliedLine[] {
  const amounts = new Map<number, number>();
  for (const l of lines) {
    if (l.calculationType === "FIXED")
      amounts.set(l.componentId, round2(l.value));
    if (l.calculationType === "PERCENT_OF_GROSS") {
      amounts.set(l.componentId, round2((grossMonthly * l.value) / 100));
    }
  }
  const basicLine = lines.find((l) => l.code === "BASIC");
  const ofBasic = lines.filter((l) => l.calculationType === "PERCENT_OF_BASIC");
  if (ofBasic.length > 0) {
    const basic = basicLine ? amounts.get(basicLine.componentId) : undefined;
    if (basic === undefined) {
      throw new TemplateRuleError(
        "A line is a percent of Basic, but the template has no fixed or percent-of-gross BASIC line",
        "TEMPLATE_BASIC_MISSING",
      );
    }
    for (const l of ofBasic) {
      amounts.set(l.componentId, round2((basic * l.value) / 100));
    }
  }

  const earningsSoFar = lines
    .filter((l) => l.kind === "EARNING" && l.calculationType !== "REMAINDER")
    .reduce((sum, l) => sum + (amounts.get(l.componentId) ?? 0), 0);
  const remainder = lines.find((l) => l.calculationType === "REMAINDER");
  if (remainder) {
    const rest = round2(grossMonthly - earningsSoFar);
    if (rest < 0) {
      throw new TemplateRuleError(
        `The template's earnings (${round2(earningsSoFar)}) exceed the gross ${grossMonthly}`,
        "TEMPLATE_EXCEEDS_GROSS",
      );
    }
    amounts.set(remainder.componentId, rest);
  } else if (Math.abs(round2(earningsSoFar) - grossMonthly) > 0.01) {
    throw new TemplateRuleError(
      `The template's earnings add up to ${round2(earningsSoFar)}, not the gross ${grossMonthly}; add a REMAINDER line or change the gross`,
      "TEMPLATE_GROSS_MISMATCH",
    );
  }

  return lines.map((l) => ({
    componentId: l.componentId,
    code: l.code,
    kind: l.kind,
    monthlyAmount: amounts.get(l.componentId) ?? 0,
  }));
}

/** The components every organization has (seeded by the migration and,
 * for an organization created later, on first use). */
export const SYSTEM_COMPONENTS = [
  { code: "BASIC", name: "Basic Salary", pfApplicable: true, displayOrder: 10 },
  {
    code: "DA",
    name: "Dearness Allowance",
    pfApplicable: true,
    displayOrder: 20,
  },
  {
    code: "HRA",
    name: "House Rent Allowance",
    pfApplicable: false,
    displayOrder: 30,
  },
  {
    code: "CONVEYANCE",
    name: "Conveyance Allowance",
    pfApplicable: false,
    displayOrder: 40,
  },
  {
    code: "OTHER_ALLOWANCE",
    name: "Other Allowance",
    pfApplicable: false,
    displayOrder: 50,
  },
  {
    code: "SPECIAL_ALLOWANCE",
    name: "Special Allowance",
    pfApplicable: false,
    displayOrder: 60,
  },
] as const;

/** Line codes the engine produces itself; not allowed as component codes
 * (also a database CHECK). */
export const RESERVED_COMPONENT_CODES = [
  "ARREARS",
  "BONUS",
  "OVERTIME",
  "PF",
  "ESI",
  "PT",
  "TDS",
  "LOAN",
  "GRATUITY",
] as const;
