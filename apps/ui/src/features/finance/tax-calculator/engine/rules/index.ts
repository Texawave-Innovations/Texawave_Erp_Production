/**
 * Centralized Tax Rule Registry
 * Resolves versioned rules for selected Financial Year
 */

import { FinancialYear } from "../types";
import { NEW_REGIME_RULES_2025_26 } from "./fy-2025-26/new-regime";
import { OLD_REGIME_RULES_2025_26 } from "./fy-2025-26/old-regime";
import { DEDUCTION_RULES_2025_26 } from "./fy-2025-26/deductions";
import { NEW_REGIME_RULES_2026_27 } from "./fy-2026-27/new-regime";
import { OLD_REGIME_RULES_2026_27 } from "./fy-2026-27/old-regime";
import { DEDUCTION_RULES_2026_27 } from "./fy-2026-27/deductions";

export function getRulesForFinancialYear(fy: FinancialYear) {
  if (fy === "2026-27") {
    return {
      newRegime: NEW_REGIME_RULES_2026_27,
      oldRegime: OLD_REGIME_RULES_2026_27,
      deductions: DEDUCTION_RULES_2026_27,
    };
  }

  // Default to FY 2025-26
  return {
    newRegime: NEW_REGIME_RULES_2025_26,
    oldRegime: OLD_REGIME_RULES_2025_26,
    deductions: DEDUCTION_RULES_2025_26,
  };
}
