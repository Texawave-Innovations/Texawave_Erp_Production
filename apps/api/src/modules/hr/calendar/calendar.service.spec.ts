import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { CalendarQueryService, CalendarService } from "./calendar.service.js";

const ORG = { organizationId: 1 };

function makeService() {
  const teamScope = {
    level: "team",
    userId: 42,
    organizationId: 1,
    teamIds: [3],
  };
  const repository = {
    dayForVisibleEmployee: vi.fn(),
    dayForEmployee: vi.fn(),
  };
  const tenantContext = { getOrgScope: vi.fn().mockReturnValue(ORG) };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  return {
    repository,
    teamContext,
    teamScope,
    service: new CalendarService(
      repository as never,
      tenantContext as never,
      teamContext as never,
    ),
    queryService: new CalendarQueryService(
      repository as never,
      tenantContext as never,
    ),
  };
}

describe("CalendarService", () => {
  it("day() is limited to employees the caller may read", async () => {
    const { service, repository, teamContext, teamScope } = makeService();
    repository.dayForVisibleEmployee.mockResolvedValue({ isWorkingDay: true });
    await service.day({ employeeId: 5, date: "2026-10-02" });
    expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.employee.read");
    expect(repository.dayForVisibleEmployee).toHaveBeenCalledWith(
      teamScope,
      5,
      new Date("2026-10-02T00:00:00.000Z"),
    );
  });

  it("day() throws not-found for an employee outside the caller's scope", async () => {
    const { service, repository } = makeService();
    repository.dayForVisibleEmployee.mockResolvedValue(null);
    await expect(
      service.day({ employeeId: 5, date: "2026-10-02" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });
});

describe("CalendarQueryService", () => {
  it("dayFor() looks up within the organization scope and performs no team check", async () => {
    const { queryService, repository, teamContext } = makeService();
    const date = new Date("2026-10-02T00:00:00.000Z");
    repository.dayForEmployee.mockResolvedValue(null);
    await queryService.dayFor(5, date);
    expect(repository.dayForEmployee).toHaveBeenCalledWith(ORG, 5, date);
    expect(teamContext.resolveScope).not.toHaveBeenCalled();
  });
});
