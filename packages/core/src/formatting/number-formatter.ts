import type { NumberFormatStyle } from "./types";

export interface FormatNumberOptions {
  style?: NumberFormatStyle | undefined;
  minDecimals?: number | undefined;
  maxDecimals?: number | undefined;
  decimals?: number | undefined;
}

/**
 * Formats a number with Indian (lakhs/crores) or International (millions/billions) grouping.
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: FormatNumberOptions,
): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return String(value);

  const style = options?.style ?? "indian";

  let minDecimals: number;
  let maxDecimals: number;

  if (options?.decimals !== undefined) {
    minDecimals = options.minDecimals ?? options.decimals;
    maxDecimals = options.maxDecimals ?? options.decimals;
  } else if (
    options?.minDecimals !== undefined ||
    options?.maxDecimals !== undefined
  ) {
    minDecimals = options.minDecimals ?? 0;
    maxDecimals = options.maxDecimals ?? Math.max(minDecimals, 2);
  } else {
    const isInteger = Number.isInteger(num);
    minDecimals = isInteger ? 0 : 2;
    maxDecimals = isInteger ? 0 : 2;
  }

  // en-IN produces Indian numbering system grouping: 1,00,000
  // en-US produces international standard grouping: 100,000
  const locale = style === "indian" ? "en-IN" : "en-US";

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });

  return formatter.format(num);
}
