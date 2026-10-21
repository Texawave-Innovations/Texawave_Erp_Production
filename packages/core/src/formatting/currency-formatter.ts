import { formatNumber, type FormatNumberOptions } from "./number-formatter";
import type { CurrencyPosition, ExchangeRateEntry } from "./types";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF",
};

/**
 * Standard baseline exchange rates relative to INR (Indian Rupee, Organization Base Currency).
 * Expressed as: 1 Foreign Unit = X INR (e.g. 1 USD = 83.25 INR, 1 EUR = 90.50 INR).
 * Triangulation and inverse calculations compute precise real conversion without symbol-swapping.
 */
export const STANDARD_BASE_EXCHANGE_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 83.25,
  EUR: 90.5,
  GBP: 108.5,
  AED: 22.67,
  CAD: 61.2,
  SGD: 62.8,
  AUD: 54.1,
  JPY: 0.55,
  CNY: 11.5,
  CHF: 93.8,
};

export interface MajorCurrencyItem {
  code: string;
  name: string;
  symbol: string;
  rateToInr: number;
}

export const MAJOR_BUSINESS_CURRENCIES: MajorCurrencyItem[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", rateToInr: 1.0 },
  { code: "USD", name: "US Dollar", symbol: "$", rateToInr: 83.25 },
  { code: "EUR", name: "Euro", symbol: "€", rateToInr: 90.5 },
  { code: "GBP", name: "British Pound", symbol: "£", rateToInr: 108.5 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", rateToInr: 22.67 },
  { code: "CAD", name: "Canadian Dollar", symbol: "$", rateToInr: 61.2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "$", rateToInr: 62.8 },
];

/**
 * Resolves the real active exchange rate between two currencies.
 * Prioritizes custom database rates, falling back to standard market reference rates.
 */
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  customRates?: ExchangeRateEntry[] | Record<string, number> | undefined,
): number {
  const from = (fromCurrency || "INR").toUpperCase();
  const to = (toCurrency || "INR").toUpperCase();
  if (from === to) return 1.0;

  // 1. Direct or inverse lookup in customRates if provided
  if (customRates) {
    if (Array.isArray(customRates)) {
      const direct = customRates.find(
        (r) =>
          r.fromCurrency?.toUpperCase() === from &&
          r.toCurrency?.toUpperCase() === to,
      );
      if (direct && Number(direct.rate) > 0) return Number(direct.rate);

      const inverse = customRates.find(
        (r) =>
          r.fromCurrency?.toUpperCase() === to &&
          r.toCurrency?.toUpperCase() === from,
      );
      if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);
    } else {
      const pairDirect = `${from}_${to}`;
      if (
        typeof customRates[pairDirect] === "number" &&
        customRates[pairDirect] > 0
      ) {
        return customRates[pairDirect];
      }
      const pairInverse = `${to}_${from}`;
      if (
        typeof customRates[pairInverse] === "number" &&
        customRates[pairInverse] > 0
      ) {
        return 1 / customRates[pairInverse];
      }
    }
  }

  // 2. Baseline standard market reference rates relative to INR
  const fromInr = from === "INR" ? 1.0 : STANDARD_BASE_EXCHANGE_RATES[from];
  const toInr = to === "INR" ? 1.0 : STANDARD_BASE_EXCHANGE_RATES[to];

  if (fromInr && toInr && toInr > 0) {
    return fromInr / toInr;
  }

  return 1.0;
}

export const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

export interface FormatCurrencyOptions extends FormatNumberOptions {
  currency?: string | undefined;
  position?: CurrencyPosition | undefined;
  showCode?: boolean | undefined;
}

/**
 * Returns the symbol for a given 3-letter currency code, falling back to the code itself.
 */
export function getCurrencySymbol(currencyCode: string): string {
  const upper = (currencyCode || "INR").toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? upper;
}

/**
 * Returns standard decimal precision for a currency code (defaults to 2).
 */
export function getCurrencyDecimals(currencyCode: string): number {
  const upper = (currencyCode || "INR").toUpperCase();
  return CURRENCY_DECIMALS[upper] ?? 2;
}

/**
 * Formats a monetary amount with currency symbol, position, and number grouping.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options?: FormatCurrencyOptions,
): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(num)) return String(amount);

  const currency = (options?.currency || "INR").toUpperCase();
  const position = options?.position ?? "before";
  const symbol = getCurrencySymbol(currency);
  const decimals = options?.minDecimals ?? getCurrencyDecimals(currency);

  const formattedValue = formatNumber(num, {
    style: options?.style ?? (currency === "INR" ? "indian" : "international"),
    minDecimals: decimals,
    maxDecimals: options?.maxDecimals ?? decimals,
  });

  if (options?.showCode) {
    return `${currency} ${formattedValue}`;
  }

  if (position === "after") {
    return `${formattedValue} ${symbol}`;
  }
  return `${symbol} ${formattedValue}`;
}

/**
 * Converts an amount from one currency to another using an explicit exchange rate.
 * Rounds to the target currency's standard decimal precision.
 */
export function convertCurrency(
  amount: number | string,
  exchangeRate: number | string,
  targetCurrency: string = "INR",
): number {
  const numericAmount = typeof amount === "string" ? Number(amount) : amount;
  const numericRate =
    typeof exchangeRate === "string" ? Number(exchangeRate) : exchangeRate;

  if (isNaN(numericAmount) || isNaN(numericRate) || numericRate <= 0) {
    return 0;
  }

  const rawConverted = numericAmount * numericRate;
  const decimals = getCurrencyDecimals(targetCurrency);
  const factor = Math.pow(10, decimals);
  return Math.round(rawConverted * factor) / factor;
}

/**
 * Converts an amount from one currency to another using the active exchange rate
 * (custom database rate or baseline market reference rate).
 */
export function convertAmountBetweenCurrencies(
  amount: number | string,
  fromCurrency: string,
  toCurrency: string,
  customRates?: ExchangeRateEntry[] | Record<string, number> | undefined,
): number {
  const rate = getExchangeRate(fromCurrency, toCurrency, customRates);
  return convertCurrency(amount, rate, toCurrency);
}
