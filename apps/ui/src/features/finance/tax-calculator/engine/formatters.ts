/**
 * TexaOne Income Tax Calculator - Currency & Number Formatters
 *
 * Complies with the Indian numbering format (e.g., ₹12,50,000)
 */

export function formatINR(amount: number, hideDecimals = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "₹0";
  }

  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);

  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: hideDecimals ? 0 : 2,
    minimumFractionDigits: hideDecimals ? 0 : 2,
  }).format(absVal);

  return `${isNegative ? "-" : ""}₹${formatted}`;
}

export function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) {
    return "0";
  }
  return new Intl.NumberFormat("en-IN").format(Math.round(num));
}

export function formatPercentage(rate: number, decimals = 2): string {
  if (isNaN(rate) || rate === null || rate === undefined) {
    return "0.00%";
  }
  return `${rate.toFixed(decimals)}%`;
}

export function formatMonthlyAmount(annualAmount: number): string {
  const monthly = (annualAmount || 0) / 12;
  return formatINR(monthly);
}

/**
 * Clean user string input to sanitized positive number
 */
export function sanitizeNumericInput(value: string | number): number {
  if (typeof value === "number") {
    return isNaN(value) || value < 0 ? 0 : Math.min(value, 1_000_000_000); // 100 Crore safety ceiling
  }
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 1_000_000_000);
}
