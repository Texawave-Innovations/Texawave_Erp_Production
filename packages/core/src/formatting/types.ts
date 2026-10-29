export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "12h" | "24h";
export type NumberFormatStyle = "indian" | "international";
export type CurrencyPosition = "before" | "after";

export type ThemePreference = "light" | "dark" | "system";
export type DensityPreference = "compact" | "comfortable" | "spacious";

export interface ExchangeRateEntry {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate?: string | undefined;
  source?: string | undefined;
}

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
  exchangeRates?: ExchangeRateEntry[] | Record<string, number> | undefined;
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
