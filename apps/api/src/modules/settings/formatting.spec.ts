import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_REGIONAL_CONFIG,
  getCurrencyDecimals,
  getCurrencySymbol,
  isValidIanaTimezone,
} from "./common/formatting-utils.js";

describe("Settings Formatting Utils (API Common)", () => {
  describe("IANA Timezone Validation", () => {
    it("validates standard IANA timezones correctly", () => {
      expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidIanaTimezone("America/New_York")).toBe(true);
      expect(isValidIanaTimezone("Europe/London")).toBe(true);
      expect(isValidIanaTimezone("UTC")).toBe(true);
    });

    it("rejects invalid or malformed timezones", () => {
      expect(isValidIanaTimezone("Fake/Timezone")).toBe(false);
      expect(isValidIanaTimezone("")).toBe(false);
      expect(isValidIanaTimezone(null as unknown as string)).toBe(false);
      expect(isValidIanaTimezone(undefined as unknown as string)).toBe(false);
      expect(isValidIanaTimezone("Invalid123")).toBe(false);
    });
  });

  describe("Currency Decimals Resolution", () => {
    it("returns zero decimals for zero-decimal currencies like JPY, KRW, VND", () => {
      expect(getCurrencyDecimals("JPY")).toBe(0);
      expect(getCurrencyDecimals("jpy")).toBe(0);
      expect(getCurrencyDecimals("KRW")).toBe(0);
      expect(getCurrencyDecimals("VND")).toBe(0);
    });

    it("returns 3 decimals for currencies like BHD, KWD, OMR", () => {
      expect(getCurrencyDecimals("BHD")).toBe(3);
      expect(getCurrencyDecimals("KWD")).toBe(3);
      expect(getCurrencyDecimals("OMR")).toBe(3);
    });

    it("defaults to 2 decimals for standard or unknown currencies", () => {
      expect(getCurrencyDecimals("INR")).toBe(2);
      expect(getCurrencyDecimals("USD")).toBe(2);
      expect(getCurrencyDecimals("EUR")).toBe(2);
      expect(getCurrencyDecimals("UNKNOWN")).toBe(2);
      expect(getCurrencyDecimals("")).toBe(2);
    });
  });

  describe("Currency Symbols Resolution", () => {
    it("resolves standard symbols", () => {
      expect(getCurrencySymbol("INR")).toBe("₹");
      expect(getCurrencySymbol("USD")).toBe("$");
      expect(getCurrencySymbol("EUR")).toBe("€");
      expect(getCurrencySymbol("GBP")).toBe("£");
      expect(getCurrencySymbol("AED")).toBe("د.إ");
      expect(getCurrencySymbol("JPY")).toBe("¥");
    });

    it("falls back to uppercase currency code for unlisted currencies", () => {
      expect(getCurrencySymbol("XYZ")).toBe("XYZ");
      expect(getCurrencySymbol("abc")).toBe("ABC");
    });
  });

  describe("Default Configurations", () => {
    it("provides valid defaults for regional formats", () => {
      expect(DEFAULT_REGIONAL_CONFIG.locale).toBe("en-IN");
      expect(DEFAULT_REGIONAL_CONFIG.timezone).toBe("Asia/Kolkata");
      expect(DEFAULT_REGIONAL_CONFIG.dateFormat).toBe("DD/MM/YYYY");
      expect(DEFAULT_REGIONAL_CONFIG.timeFormat).toBe("12h");
      expect(DEFAULT_REGIONAL_CONFIG.baseCurrency).toBe("INR");
      expect(DEFAULT_REGIONAL_CONFIG.numberFormat).toBe("indian");
      expect(DEFAULT_REGIONAL_CONFIG.fiscalYearStartMonth).toBe(4);
    });

    it("provides valid defaults for user preferences", () => {
      expect(DEFAULT_PREFERENCES.theme).toBe("system");
      expect(DEFAULT_PREFERENCES.density).toBe("comfortable");
    });
  });
});
