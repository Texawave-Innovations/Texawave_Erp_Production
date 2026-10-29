export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "12h" | "24h";
export type NumberFormatStyle = "indian" | "international";
export type CurrencyPosition = "before" | "after";

export type ThemePreference = "light" | "dark" | "system";
export type DensityPreference = "compact" | "comfortable" | "spacious";

export interface RegionalFormatConfig {
  country?: string | undefined;
  locale: string;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  baseCurrency: string;
  displayCurrency?: string | undefined;
  currencySymbolPosition: CurrencyPosition;
  numberFormat: NumberFormatStyle;
  fiscalYearStartMonth?: number | undefined;
}

export interface UserPreferencesConfig {
  theme: ThemePreference;
  density: DensityPreference;
  locale?: string | undefined;
  timezone?: string | undefined;
  dateFormat?: DateFormat | undefined;
  timeFormat?: TimeFormat | undefined;
  displayCurrency?: string | undefined;
}

export interface EffectivePreferences extends RegionalFormatConfig {
  theme: ThemePreference;
  density: DensityPreference;
  displayCurrency: string;
  isUserOverridden: {
    theme: boolean;
    density: boolean;
    locale: boolean;
    timezone: boolean;
    dateFormat: boolean;
    timeFormat: boolean;
    displayCurrency: boolean;
  };
}

export const DEFAULT_REGIONAL_CONFIG: RegionalFormatConfig = {
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  baseCurrency: "INR",
  displayCurrency: "INR",
  currencySymbolPosition: "before",
  numberFormat: "indian",
  fiscalYearStartMonth: 4,
};

export const DEFAULT_PREFERENCES: UserPreferencesConfig = {
  theme: "system",
  density: "comfortable",
};

/**
 * Validates whether a given string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

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

export const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

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
 * Returns standard decimal precision for a currency code (defaults to 2).
 */
export function getCurrencyDecimals(currencyCode: string): number {
  const upper = (currencyCode || "INR").toUpperCase();
  return CURRENCY_DECIMALS[upper] ?? 2;
}

/**
 * Returns the symbol for a given 3-letter currency code, falling back to the code itself.
 */
export function getCurrencySymbol(currencyCode: string): string {
  const upper = (currencyCode || "INR").toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? upper;
}
