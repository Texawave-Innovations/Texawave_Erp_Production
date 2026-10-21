import { describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { OrganizationSettingsService } from "./organization-settings.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const DEFAULT_SETTINGS = {
  id: 1,
  organizationId: 1,
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
    findOrCreateDefault: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    update: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const auditWriter = {
    write: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    $transaction: vi.fn(
      async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        return callback({});
      },
    ),
  };

  const service = new OrganizationSettingsService(
    repository as never,
    tenantContext as never,
    auditWriter as never,
    prisma as never,
  );

  return { service, repository, auditWriter, prisma };
}

describe("OrganizationSettingsService", () => {
  it("getSettings() returns the organization settings row or creates defaults", async () => {
    const { service, repository } = makeService();

    const result = await service.getSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(repository.findOrCreateDefault).toHaveBeenCalledWith(SCOPE, USER_ID);
  });

  it("updateSettings() throws BusinessRuleViolationException on invalid IANA timezone", async () => {
    const { service } = makeService();

    await expect(
      service.updateSettings({ timezone: "Mars/Olympus_Mons" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it("updateSettings() saves changes inside transaction and records audit log", async () => {
    const { service, repository, auditWriter } = makeService();
    const updated = {
      ...DEFAULT_SETTINGS,
      country: "US",
      locale: "en-US",
      timezone: "America/New_York",
      baseCurrency: "USD",
      dateFormat: "MM/DD/YYYY",
      numberFormat: "international",
    };
    repository.update.mockResolvedValueOnce(updated);

    const result = await service.updateSettings({
      country: "US",
      locale: "en-US",
      timezone: "America/New_York",
      baseCurrency: "USD",
      dateFormat: "MM/DD/YYYY",
      numberFormat: "international",
    });

    expect(repository.update).toHaveBeenCalled();
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "organization_setting",
        entityId: 1,
        action: "update",
        before: DEFAULT_SETTINGS,
        after: updated,
      }),
    );
    expect(result).toEqual(updated);
  });
});
