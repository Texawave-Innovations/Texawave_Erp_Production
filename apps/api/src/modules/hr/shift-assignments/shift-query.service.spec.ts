import { ShiftQueryService } from "./shift-query.service.js";

describe("ShiftQueryService", () => {
  it("shiftFor() resolves within the organization scope, without a team check", async () => {
    const org = { organizationId: 1 };
    const repository = { resolve: vi.fn().mockResolvedValue(null) };
    const tenantContext = { getOrgScope: vi.fn().mockReturnValue(org) };
    const service = new ShiftQueryService(
      repository as never,
      tenantContext as never,
    );
    const date = new Date("2026-10-02T00:00:00.000Z");
    await service.shiftFor(5, date);
    expect(repository.resolve).toHaveBeenCalledWith(org, 5, date);
  });
});
