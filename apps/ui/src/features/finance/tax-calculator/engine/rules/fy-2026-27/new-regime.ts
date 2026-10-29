/**
 * Tax Rules: FY 2026-27 (AY 2027-28) - New Tax Regime
 *
 * Statutory Authority:
 * - Finance Act provisions continuing into subsequent assessment cycle
 */

import { NEW_REGIME_RULES_2025_26 } from "../fy-2025-26/new-regime";

export const NEW_REGIME_RULES_2026_27 = {
  ...NEW_REGIME_RULES_2025_26,
  financialYear: "2026-27" as const,
  assessmentYear: "2027-28" as const,
};
