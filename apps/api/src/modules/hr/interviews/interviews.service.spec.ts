import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { InterviewsService } from "./interviews.service.js";

const ORG = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    setStatus: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new InterviewsService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

const base = {
  candidateName: "  Ramesh Kumar  ",
  roleTitle: "Full Stack Developer",
  interviewerName: "Tech Lead",
  interviewDate: "2026-10-12",
  interviewTime: "14:30",
};

describe("InterviewsService", () => {
  it("create() defaults the mode to ONLINE, as legacy does, and stores empty notes as null", async () => {
    const { service, repository } = makeService();
    await service.create({ ...base, notes: "" } as never);

    expect(repository.create).toHaveBeenCalledWith(
      ORG,
      {
        candidateName: "  Ramesh Kumar  ",
        roleTitle: "Full Stack Developer",
        interviewerName: "Tech Lead",
        interviewDate: "2026-10-12",
        interviewTime: "14:30",
        mode: "ONLINE",
        notes: null,
      },
      42,
    );
  });

  it("create() keeps an explicit mode and notes", async () => {
    const { service, repository } = makeService();
    await service.create({
      ...base,
      mode: "PHONE",
      notes: "Check resume",
    } as never);

    expect(repository.create.mock.calls[0]?.[1]).toMatchObject({
      mode: "PHONE",
      notes: "Check resume",
    });
  });

  it("setStatus() passes the requested status through, including the current one", async () => {
    const { service, repository } = makeService();
    repository.setStatus.mockResolvedValue({ id: 5, status: "SCHEDULED" });
    await service.setStatus(5, { status: "SCHEDULED" } as never);

    expect(repository.setStatus).toHaveBeenCalledWith(ORG, 5, "SCHEDULED", 42);
  });

  it("setStatus() answers not-found for an id outside the organization", async () => {
    const { service, repository } = makeService();
    repository.setStatus.mockResolvedValue(null);
    await expect(
      service.setStatus(9, { status: "SELECTED" } as never),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it("findOne() answers not-found for an id outside the organization", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("findAll() forwards the search and status filters and returns a page", async () => {
    const { service, repository } = makeService();
    const page = await service.findAll({
      page: 1,
      limit: 10,
      search: "ramesh",
      status: "NO_SHOW",
    } as never);

    expect(repository.findMany).toHaveBeenCalledWith(
      ORG,
      { search: "ramesh", status: "NO_SHOW" },
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    expect(page).toBeInstanceOf(PaginatedResponseDto);
  });
});
