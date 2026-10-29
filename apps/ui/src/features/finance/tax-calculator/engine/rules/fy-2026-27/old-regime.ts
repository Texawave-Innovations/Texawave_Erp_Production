/**
 * Tax Rules: FY 2026-27 (AY 2027-28) - Old Tax Regime
 */

import { OLD_REGIME_RULES_2025_26 } from "../fy-2025-26/old-regime";

export const OLD_REGIME_RULES_2026_27 = {
  ...OLD_REGIME_RULES_2025_26,
  financialYear: "2026-27" as const,
  assessmentYear: "2027-28" as const,
};
