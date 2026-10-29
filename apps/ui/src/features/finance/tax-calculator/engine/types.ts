/**
 * TexaOne Income Tax Calculator - Type Definitions
 *
 * Strict TypeScript models for taxpayer profile, income sources, deductions,
 * calculation rules, and detailed output breakdowns.
 */

export type FinancialYear = "2025-26" | "2026-27";
export type AssessmentYear = "2026-27" | "2027-28";

export type TaxRegime = "new" | "old";
export type AgeCategory = "regular" | "senior" | "super_senior"; // regular < 60, senior 60-79, super_senior 80+
export type ResidentialStatus = "resident" | "non_resident";
export type EmploymentType = "salaried" | "self_employed" | "pensioner";
export type CityClassification = "metro" | "non_metro"; // 50% vs 40% for HRA

/**
 * Normal Slab Income breakdown inputs.
 */
export interface IncomeInputs {
  /** Annual Gross Salary (Base for salary income computation) */
  grossSalary: number;
  /** Basic Salary (used for HRA exemption calculation) */
  basicSalary: number;
  /** House Rent Allowance received from employer */
  hraReceived: number;
  /** Actual rent paid per annum by employee */
  rentPaidAnnual: number;
  /** Location of rental accommodation */
  cityType: CityClassification;
  /** Income from House Property (Net annual value after municipal taxes, or negative for home loan interest) */
  rentalIncome: number;
  /** Interest income from Savings Bank Accounts */
  savingsInterest: number;
  /** Interest income from Fixed Deposits & other deposits */
  fixedDepositInterest: number;
  /** Any other normal slab income (e.g. consulting, dividend, freelance) */
  otherIncome: number;
  /** Optional informational CTC reference (never treated as taxable salary) */
  annualCTC?: number;
}

/**
 * Deductions allowable primarily under Chapter VI-A (Old Regime)
 */
export interface DeductionsInputs {
  /** Section 80C: EPF, PPF, ELSS, Life Insurance, Tuition fees, etc. (Max ₹1,50,000) */
  section80C: number;
  /** Section 80D - Self, spouse, children health insurance premium */
  section80D_Self: number;
  /** Is self/spouse a senior citizen (>= 60 years)? */
  isSelfSenior: boolean;
  /** Section 80D - Parents health insurance premium */
  section80D_Parents: number;
  /** Are parents senior citizens (>= 60 years)? */
  isParentsSenior: boolean;
  /** Section 80CCD(1B): Additional self-contribution to NPS (Max ₹50,000) */
  section80CCD1B: number;
  /** Section 80CCD(2): Employer's contribution to NPS (Allowed in both Old & New regimes) */
  section80CCD2: number;
  /** Section 24(b): Interest on housing loan for self-occupied property (Max ₹2,00,000) */
  section24b: number;
  /** Section 80G: Eligible charitable donations */
  section80G: number;
  /** Section 80E: Interest on higher education loan */
  section80E: number;
}

export interface TaxpayerProfile {
  financialYear: FinancialYear;
  ageCategory: AgeCategory;
  residentialStatus: ResidentialStatus;
  employmentType: EmploymentType;
  tdsPaid: number;
}

export interface SlabCalculation {
  slabRange: string;
  fromAmount: number;
  toAmount: number | null; // null for above top threshold
  ratePercent: number;
  taxableAmountInSlab: number;
  taxGenerated: number;
}

export interface RegimeTaxResult {
  regime: TaxRegime;
  grossIncome: number;
  hraExemption: number;
  standardDeduction: number;
  professionalTax: number;
  totalExemptions: number;
  netSalaryIncome: number;
  incomeFromHouseProperty: number;
  incomeFromOtherSources: number;
  grossTotalIncome: number;
  eligibleDeductions80C: number;
  eligibleDeductions80D: number;
  eligibleDeductions80CCD1B: number;
  eligibleDeductions80CCD2: number;
  eligibleDeductions80TTA_TTB: number;
  otherEligibleDeductions: number;
  totalEligibleDeductions: number;
  taxableIncome: number;
  slabTaxBeforeRebate: number;
  slabBreakdown: SlabCalculation[];
  section87ARebate: number;
  marginalRelief87A: number;
  taxAfterRebate: number;
  surchargePercent: number;
  surchargeAmount: number;
  surchargeMarginalRelief: number;
  taxBeforeCess: number;
  healthAndEducationCess: number; // 4%
  totalTaxLiability: number;
  effectiveTaxRate: number; // percentage of grossTotalIncome
  tdsPaid: number;
  balanceTaxPayable: number;
  refundDue: number;
}

export interface ComparisonResult {
  financialYear: FinancialYear;
  oldRegime: RegimeTaxResult;
  newRegime: RegimeTaxResult;
  taxDifference: number; // |old - new|
  lowerTaxRegime: TaxRegime | "equal";
}
