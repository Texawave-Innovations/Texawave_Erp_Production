import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { OfferLettersService } from "./offer-letters.service.js";

const ORG = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new OfferLettersService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("OfferLettersService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("create() applies every legacy prefill when the request omits it", async () => {
    const { service, repository } = makeService();
    await service.create({
      candidateName: "Arun Kumar R",
      role: "Senior Software Engineer",
      joiningDate: "2026-11-01",
    } as never);

    expect(repository.create).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({
        candidateName: "Arun Kumar R",
        role: "Senior Software Engineer",
        location: "Chennai",
        reportingManager: "Mr. Nithyanandan Ramaraj",
        offerDate: "2026-10-05",
        joiningDate: "2026-11-01",
        offerValidityDate: "2026-10-12",
        basic: "0.00",
        da: "0.00",
        hra: "0.00",
        ca: "0.00",
        workScheduleSun: "Week Off",
        signatoryName: "Amanullah Khan",
        signatoryDesignation: "Co-Founder",
        companyEmail: "contact@texawave.com",
      }),
      42,
    );
  });

  it("create() uses the values the request supplies, with money at 2 dp", async () => {
    const { service, repository } = makeService();
    await service.create({
      candidateName: "Arun Kumar R",
      role: "Lead",
      joiningDate: "2026-11-01",
      offerDate: "2026-10-01",
      offerValidityDate: "2026-10-20",
      ca: 1500.5,
    } as never);

    expect(repository.create.mock.calls[0]?.[1]).toMatchObject({
      offerDate: "2026-10-01",
      offerValidityDate: "2026-10-20",
      ca: "1500.50",
    });
  });

  it("update() writes only the fields the request names, so status and other terms are untouched", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue({ id: 3 });
    await service.update(3, { role: "Principal Engineer", ca: 2000 } as never);

    expect(repository.update).toHaveBeenCalledWith(
      ORG,
      3,
      { role: "Principal Engineer", ca: "2000.00" },
      42,
    );
  });

  it("update() answers not-found for an id outside the organization", async () => {
    const { service, repository } = makeService();
    repository.update.mockResolvedValue(null);
    await expect(
      service.update(9, { role: "X" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("findOne() answers not-found for an id outside the organization", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
