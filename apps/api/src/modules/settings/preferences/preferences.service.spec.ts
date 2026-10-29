import { describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { PreferencesService } from "./preferences.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const ORG_SETTINGS = {
  theme: "system",
  density: "comfortable",
  country: "IN",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  baseCurrency: "INR",
  currencySymbolPosition: "before",
  numberFormat: "indian",
  fiscalYearStartMonth: 4,
};

function makeService() {
  const repository = {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
    deleteByUserId: vi.fn(),
  };
  const orgSettingsRepo = {
    findOrCreateDefault: vi.fn().mockResolvedValue(ORG_SETTINGS),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new PreferencesService(
    repository as never,
    orgSettingsRepo as never,
    tenantContext as never,
  );

  return { service, repository, orgSettingsRepo };
}

describe("PreferencesService", () => {
  it("getPreferences() falls back to organization defaults when user has no preferences", async () => {
    const { service, repository } = makeService();
    repository.findByUserId.mockResolvedValue(null);

    const result = await service.getPreferences();

    expect(result.preferences).toBeNull();
    expect(result.effective.theme).toBe("system");
    expect(result.effective.density).toBe("comfortable");
    expect(result.effective.timezone).toBe("Asia/Kolkata");
    expect(result.effective.baseCurrency).toBe("INR");
    expect(result.effective.displayCurrency).toBe("INR");
  });

  it("getPreferences() applies user overrides over organization defaults", async () => {
    const { service, repository } = makeService();
    repository.findByUserId.mockResolvedValue({
      id: 1,
      userId: USER_ID,
      organizationId: 1,
      theme: "dark",
      density: "compact",
      timezone: "America/New_York",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      displayCurrency: "USD",
      customFields: {},
    });

    const result = await service.getPreferences();

    expect(result.preferences?.theme).toBe("dark");
    expect(result.effective.theme).toBe("dark");
    expect(result.effective.density).toBe("compact");
    expect(result.effective.timezone).toBe("America/New_York");
    expect(result.effective.dateFormat).toBe("YYYY-MM-DD");
    expect(result.effective.timeFormat).toBe("24h");
    expect(result.effective.displayCurrency).toBe("USD");
    expect(result.effective.baseCurrency).toBe("INR"); // base currency remains org default
  });

  it("updatePreferences() rejects invalid IANA timezone", async () => {
    const { service } = makeService();

    await expect(
      service.updatePreferences({ timezone: "Invalid/Timezone" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it("updatePreferences() persists valid preferences and resolves effective result", async () => {
    const { service, repository } = makeService();
    repository.upsert.mockResolvedValue({
      id: 1,
      userId: USER_ID,
      organizationId: 1,
      theme: "light",
      density: "spacious",
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12h",
      displayCurrency: "INR",
      customFields: {},
    });

    const result = await service.updatePreferences({
      theme: "light",
      density: "spacious",
    });

    expect(repository.upsert).toHaveBeenCalledWith(SCOPE, USER_ID, {
      theme: "light",
      density: "spacious",
    });
    expect(result.effective.theme).toBe("light");
    expect(result.effective.density).toBe("spacious");
  });

  it("resetPreferences() deletes user preferences and falls back completely to org defaults", async () => {
    const { service, repository } = makeService();

    const result = await service.resetPreferences();

    expect(repository.deleteByUserId).toHaveBeenCalledWith(SCOPE, USER_ID);
    expect(result.preferences).toBeNull();
    expect(result.effective.theme).toBe("system");
    expect(result.effective.density).toBe("comfortable");
  });
});
