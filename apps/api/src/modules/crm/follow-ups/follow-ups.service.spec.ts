import { describe, expect, it, vi } from "vitest";
import { FollowUpsService } from "./follow-ups.service.js";

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(1),
  };
  const service = new FollowUpsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("FollowUpsService", () => {
  /** Legacy `getEffectiveFollowUpStatus()` — the computed, never-persisted
   * OVERDUE state. Confirms it's derived purely from `scheduledAt` vs now,
   * never read off the stored `status` column directly for a PENDING row. */
  it("derives OVERDUE for a PENDING row whose scheduledAt has passed, without mutating the stored status", async () => {
    const { service, repository } = makeService();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    repository.findOne.mockResolvedValue({
      id: 1,
      status: "PENDING",
      scheduledAt: past,
    });

    const result = await service.findOne(1);

    expect(result.status).toBe("PENDING"); // stored value untouched
    expect(result.effectiveStatus).toBe("OVERDUE"); // display-only derivation
  });

  it("keeps a PENDING row due in the future as PENDING", async () => {
    const { service, repository } = makeService();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    repository.findOne.mockResolvedValue({
      id: 2,
      status: "PENDING",
      scheduledAt: future,
    });

    const result = await service.findOne(2);

    expect(result.effectiveStatus).toBe("PENDING");
  });

  it("never derives OVERDUE for a non-PENDING row, even if scheduledAt has passed", async () => {
    const { service, repository } = makeService();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    repository.findOne.mockResolvedValue({
      id: 3,
      status: "COMPLETED",
      scheduledAt: past,
    });

    const result = await service.findOne(3);

    expect(result.effectiveStatus).toBe("COMPLETED");
  });
});
