import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service.js";

const NOW = new Date("2026-11-16T10:00:00Z");
const SCOPE = { organizationId: 1 };

function makeService(
  pref: { dndUntil: Date | null; dndIndefinite: boolean } | null,
) {
  const repository = {
    findPreference: vi.fn().mockResolvedValue(pref),
    savePreference: vi
      .fn()
      .mockImplementation(
        async (
          _s: unknown,
          _u: number,
          dnd: { dndUntil: Date | null; dndIndefinite: boolean },
        ) => dnd,
      ),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new NotificationsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("NotificationsService — Do Not Disturb", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("reads only the caller's own preference", async () => {
    const { service, repository } = makeService(null);
    expect(await service.getDnd()).toEqual({
      active: false,
      until: null,
      indefinite: false,
    });
    expect(repository.findPreference).toHaveBeenCalledWith(SCOPE, 42);
  });

  it("saves a timed snooze for the caller and reports it active", async () => {
    const { service, repository } = makeService(null);
    const until = new Date(NOW.getTime() + 60 * 60_000);
    const state = await service.setDnd({ until: until.toISOString() });
    expect(repository.savePreference).toHaveBeenCalledWith(SCOPE, 42, {
      dndUntil: until,
      dndIndefinite: false,
    });
    expect(state).toEqual({
      active: true,
      until: until.toISOString(),
      indefinite: false,
    });
  });

  it("saves an indefinite snooze", async () => {
    const { service, repository } = makeService(null);
    const state = await service.setDnd({ indefinite: true });
    expect(repository.savePreference).toHaveBeenCalledWith(SCOPE, 42, {
      dndUntil: null,
      dndIndefinite: true,
    });
    expect(state.indefinite).toBe(true);
  });

  it("turns it off with neither", async () => {
    const { service } = makeService({ dndUntil: null, dndIndefinite: true });
    expect(await service.setDnd({ until: null })).toEqual({
      active: false,
      until: null,
      indefinite: false,
    });
  });

  it("refuses a time in the past and writes nothing", async () => {
    const { service, repository } = makeService(null);
    await expect(
      service.setDnd({ until: new Date(NOW.getTime() - 1000).toISOString() }),
    ).rejects.toMatchObject({ errorCode: "UNTIL_NOT_IN_FUTURE" });
    expect(repository.savePreference).not.toHaveBeenCalled();
  });

  it("refuses more than 7 days", async () => {
    const { service } = makeService(null);
    await expect(
      service.setDnd({
        until: new Date(NOW.getTime() + 8 * 86_400_000).toISOString(),
      }),
    ).rejects.toMatchObject({ errorCode: "UNTIL_TOO_FAR" });
  });
});
