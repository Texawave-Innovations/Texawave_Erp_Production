import { describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { ExchangeRatesService } from "./exchange-rates.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findRateOnOrBefore: vi.fn(),
    upsert: vi.fn(),
  };
  const orgSettingsRepo = {
    findByOrg: vi.fn().mockResolvedValue({
      baseCurrency: "INR",
    }),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new ExchangeRatesService(
    repository as never,
    orgSettingsRepo as never,
    tenantContext as never,
  );

  return { service, repository, orgSettingsRepo };
}

describe("ExchangeRatesService", () => {
  describe("convertCurrency", () => {
    it("returns 1.0 identity conversion when from and to currencies match", async () => {
      const { service, repository } = makeService();

      const result = await service.convertCurrency({
        amount: 250,
        from: "INR",
        to: "INR",
      });

      expect(result.rate).toBe(1.0);
      expect(result.convertedAmount).toBe(250);
      expect(result.method).toBe("identity");
      expect(repository.findRateOnOrBefore).not.toHaveBeenCalled();
    });

    it("uses direct rate lookup when available", async () => {
      const { service, repository } = makeService();
      repository.findRateOnOrBefore.mockResolvedValueOnce({
        rate: "83.250000",
        effectiveDate: new Date("2026-10-15"),
        source: "RBI",
      });

      const result = await service.convertCurrency({
        amount: 100,
        from: "USD",
        to: "INR",
        date: "2026-10-16",
      });

      expect(result.rate).toBe(83.25);
      expect(result.convertedAmount).toBe(8325);
      expect(result.method).toBe("direct");
      expect(result.source).toBe("RBI");
    });

    it("falls back to inverse rate lookup when direct rate does not exist", async () => {
      const { service, repository } = makeService();
      // First call (direct USD -> EUR) returns null
      repository.findRateOnOrBefore.mockResolvedValueOnce(null);
      // Second call (inverse EUR -> USD) returns rate 1.25
      repository.findRateOnOrBefore.mockResolvedValueOnce({
        rate: "1.250000",
        effectiveDate: new Date("2026-10-15"),
        source: "ECB",
      });

      const result = await service.convertCurrency({
        amount: 100,
        from: "USD",
        to: "EUR",
      });

      // 1 / 1.25 = 0.8
      expect(result.rate).toBe(0.8);
      expect(result.convertedAmount).toBe(80);
      expect(result.method).toBe("inverse");
    });

    it("falls back to triangulation via base currency when cross-rate is missing", async () => {
      const { service, repository } = makeService();
      // Direct GBP -> EUR returns null
      repository.findRateOnOrBefore.mockResolvedValueOnce(null);
      // Inverse EUR -> GBP returns null
      repository.findRateOnOrBefore.mockResolvedValueOnce(null);

      // Triangulation via base currency (INR):
      // 1. GBP -> INR = 105.00
      repository.findRateOnOrBefore.mockResolvedValueOnce({
        rate: "105.000000",
        effectiveDate: new Date("2026-10-15"),
      });
      // 2. INR -> EUR = 0.011 (or direct base -> to)
      repository.findRateOnOrBefore.mockResolvedValueOnce({
        rate: "0.011000",
        effectiveDate: new Date("2026-10-15"),
      });

      const result = await service.convertCurrency({
        amount: 100,
        from: "GBP",
        to: "EUR",
      });

      expect(result.method).toBe("triangulation");
      expect(result.viaCurrency).toBe("INR");
      expect(result.convertedAmount).toBe(115.5);
    });

    it("falls back to standard market reference rates when custom DB rates do not exist", async () => {
      const { service, repository } = makeService();
      repository.findRateOnOrBefore.mockResolvedValue(null);

      const result = await service.convertCurrency({
        amount: 90000,
        from: "INR",
        to: "USD",
      });

      expect(result.source).toBe("standard_reference");
      // 90,000 / 83.25 ≈ 1081.08
      expect(result.convertedAmount).toBe(1081.08);
      expect(result.rate).toBeCloseTo(0.012012, 5);
    });

    it("throws BusinessRuleViolationException when rate cannot be resolved", async () => {
      const { service, repository } = makeService();
      repository.findRateOnOrBefore.mockResolvedValue(null);

      await expect(
        service.convertCurrency({
          amount: 50,
          from: "BHD",
          to: "KWD",
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });
  });

  describe("upsertRate", () => {
    it("rejects same-currency exchange rates", async () => {
      const { service } = makeService();

      await expect(
        service.upsertRate({
          fromCurrency: "USD",
          toCurrency: "USD",
          rate: 1.0,
          effectiveDate: "2026-10-16",
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });

    it("rejects non-positive rates", async () => {
      const { service } = makeService();

      await expect(
        service.upsertRate({
          fromCurrency: "USD",
          toCurrency: "INR",
          rate: 0,
          effectiveDate: "2026-10-16",
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });

    it("persists valid exchange rate", async () => {
      const { service, repository } = makeService();
      repository.upsert.mockResolvedValueOnce({
        id: 1,
        organizationId: 1,
        fromCurrency: "USD",
        toCurrency: "INR",
        rate: "83.500000",
        effectiveDate: new Date("2026-10-16"),
        source: "manual",
      });

      const result = await service.upsertRate({
        fromCurrency: "USD",
        toCurrency: "INR",
        rate: 83.5,
        effectiveDate: "2026-10-16",
      });

      expect(result.rate).toBe(83.5);
      expect(result.fromCurrency).toBe("USD");
      expect(result.toCurrency).toBe("INR");
    });
  });
});
