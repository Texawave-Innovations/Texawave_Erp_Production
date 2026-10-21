import { formatDate, formatDateTime, formatTime } from "./date-formatter";
import { formatNumber, type FormatNumberOptions } from "./number-formatter";
import {
  convertCurrency,
  formatCurrency,
  getCurrencyDecimals,
  getCurrencySymbol,
  getExchangeRate,
  type FormatCurrencyOptions,
} from "./currency-formatter";
import { DEFAULT_REGIONAL_CONFIG, type RegionalFormatConfig } from "./types";

export interface RegionalCurrencyOptions extends Omit<
  FormatCurrencyOptions,
  "currency" | "position"
> {
  currency?: string | undefined;
  fromCurrency?: string | undefined;
  noConvert?: boolean | undefined;
}

/**
 * Unified, locale-aware regional formatter instance.
 * Reusable across forms, tables, dashboards, exports, and backend services.
 * Performs real multi-currency conversion based on active exchange rates and user preferences.
 */
export class RegionalFormatter {
  private config: RegionalFormatConfig;

  constructor(config?: Partial<RegionalFormatConfig>) {
    this.config = {
      ...DEFAULT_REGIONAL_CONFIG,
      ...config,
    };
  }

  public getConfig(): Readonly<RegionalFormatConfig> {
    return this.config;
  }

  public setConfig(updated: Partial<RegionalFormatConfig>): void {
    this.config = {
      ...this.config,
      ...updated,
    };
  }

  /**
   * Resolves the exchange rate between two currencies using configured rates or defaults.
   */
  public getExchangeRate(fromCurrency?: string, toCurrency?: string): number {
    const from = fromCurrency || this.config.baseCurrency || "INR";
    const to =
      toCurrency ||
      this.config.displayCurrency ||
      this.config.baseCurrency ||
      "INR";
    return getExchangeRate(from, to, this.config.exchangeRates);
  }

  /**
   * Converts a numeric amount from one currency to another using the active exchange rate.
   */
  public convert(
    amount: number | string | null | undefined,
    fromCurrency?: string,
    toCurrency?: string,
  ): number {
    if (amount === null || amount === undefined || amount === "") return 0;
    const num = typeof amount === "string" ? Number(amount) : amount;
    if (isNaN(num)) return 0;

    const from = fromCurrency || this.config.baseCurrency || "INR";
    const to =
      toCurrency ||
      this.config.displayCurrency ||
      this.config.baseCurrency ||
      "INR";
    const rate = this.getExchangeRate(from, to);
    return convertCurrency(num, rate, to);
  }

  /**
   * Format a date value into configured DateFormat and TimeZone.
   */
  public date(dateInput: Date | string | number | null | undefined): string {
    return formatDate(dateInput, this.config.dateFormat, this.config.timezone);
  }

  /**
   * Format a time value into configured TimeFormat and TimeZone.
   */
  public time(dateInput: Date | string | number | null | undefined): string {
    return formatTime(dateInput, this.config.timeFormat, this.config.timezone);
  }

  /**
   * Format a date and time together.
   */
  public dateTime(
    dateInput: Date | string | number | null | undefined,
  ): string {
    return formatDateTime(dateInput, {
      dateFormat: this.config.dateFormat,
      timeFormat: this.config.timeFormat,
      timeZone: this.config.timezone,
    });
  }

  /**
   * Format a number with configured grouping style (Indian vs. International).
   */
  public number(
    value: number | string | null | undefined,
    options?: FormatNumberOptions,
  ): string {
    return formatNumber(value, {
      style: options?.style ?? this.config.numberFormat,
      minDecimals: options?.minDecimals,
      maxDecimals: options?.maxDecimals,
      decimals: options?.decimals,
    });
  }

  /**
   * Format a monetary amount with real multi-currency conversion, symbol, and position.
   * If displayCurrency differs from baseCurrency, the amount is converted using the active
   * exchange rate (never simply swapped with a different symbol).
   */
  public currency(
    amount: number | string | null | undefined,
    currencyOverrideOrOptions?: string | RegionalCurrencyOptions,
    maybeOptions?: RegionalCurrencyOptions,
  ): string {
    if (amount === null || amount === undefined || amount === "") return "";
    let numericAmount = typeof amount === "string" ? Number(amount) : amount;
    if (isNaN(numericAmount)) return String(amount);

    let currencyOverride: string | undefined;
    let opts: RegionalCurrencyOptions = {};

    if (typeof currencyOverrideOrOptions === "string") {
      currencyOverride = currencyOverrideOrOptions;
      opts = maybeOptions ?? {};
    } else if (currencyOverrideOrOptions) {
      opts = currencyOverrideOrOptions;
      currencyOverride = opts.currency;
    }

    const targetCurrency = (
      currencyOverride ||
      opts.currency ||
      this.config.displayCurrency ||
      this.config.baseCurrency ||
      "INR"
    ).toUpperCase();

    const fromCurrency = (
      opts.fromCurrency ||
      this.config.baseCurrency ||
      "INR"
    ).toUpperCase();

    // Perform real multi-currency conversion when target differs from source
    if (!opts.noConvert && targetCurrency !== fromCurrency) {
      const rate = this.getExchangeRate(fromCurrency, targetCurrency);
      numericAmount = convertCurrency(numericAmount, rate, targetCurrency);
    }

    return formatCurrency(numericAmount, {
      ...opts,
      currency: targetCurrency,
      position: this.config.currencySymbolPosition,
      style: this.config.numberFormat,
    });
  }

  /**
   * Explicitly convert and format an amount from one currency to another.
   */
  public convertAndFormat(
    amount: number | string | null | undefined,
    fromCurrency: string,
    toCurrency: string,
    options?: Omit<RegionalCurrencyOptions, "currency" | "fromCurrency">,
  ): string {
    return this.currency(amount, toCurrency, {
      ...options,
      fromCurrency,
    });
  }

  public getCurrencySymbol(currencyCode?: string): string {
    return getCurrencySymbol(
      currencyCode || this.config.displayCurrency || this.config.baseCurrency,
    );
  }

  public getCurrencyDecimals(currencyCode?: string): number {
    return getCurrencyDecimals(
      currencyCode || this.config.displayCurrency || this.config.baseCurrency,
    );
  }

  // Convenient aliases matching top-level function names
  public formatDate = this.date.bind(this);
  public formatTime = this.time.bind(this);
  public formatDateTime = this.dateTime.bind(this);
  public formatNumber = this.number.bind(this);
  public formatCurrency = this.currency.bind(this);
  public convertCurrency = this.convert.bind(this);
}

/**
 * Global default formatter using standard Indian regional conventions.
 */
export const defaultFormatter = new RegionalFormatter();
