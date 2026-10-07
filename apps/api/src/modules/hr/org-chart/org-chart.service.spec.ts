import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import type { OrgChartRow } from "./org-chart.repository.js";
import { OrgChartService } from "./org-chart.service.js";

const scopeOf = (
  level: TeamScope["level"],
  teamIds: number[] = [],
  organizationId = 1,
): TeamScope => ({ level, userId: 9, organizationId, teamIds });

const row = (id: number, reportsToId: number | null, name = `P${id}`) =>
  ({
    id,
    employeeCode: `EMP-${id}`,
    fullName: name,
    reportsToId,
    designation: { id: 1, name: "Engineer" },
    department: { id: 1, name: "Engineering" },
    team: { id: 1, name: "Software" },
  }) as OrgChartRow;

function makeService(scope: TeamScope) {
  const repository = {
    findVisibleMembers: vi.fn().mockResolvedValue([]),
    findVisibleById: vi.fn().mockResolvedValue(null),
    findVisibleDirectReports: vi.fn().mockResolvedValue([]),
    countVisibleDirectReports: vi.fn().mockResolvedValue(new Map()),
  };
  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue(scope),
  };
  const service = new OrgChartService(
    repository as never,
    teamContext as never,
  );
  return { service, repository, teamContext };
}

describe("OrgChartService", () => {
  describe("permission and scope", () => {
    it("resolves hr.employee.read — no new permission is introduced", async () => {
      const { service, teamContext } = makeService(scopeOf("team", [1]));
      await service.getChart({});
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.employee.read");
    });

    it("passes the resolved scope to every repository read", async () => {
      const scope = scopeOf("team", [4]);
      const { service, repository } = makeService(scope);
      repository.findVisibleById.mockResolvedValue(row(2, null));
      await service.getChart({});
      await service.directReports(2);
      expect(repository.findVisibleMembers.mock.calls[0]![0]).toBe(scope);
      expect(repository.findVisibleById.mock.calls[0]![0]).toBe(scope);
      expect(repository.findVisibleDirectReports.mock.calls[0]![0]).toBe(scope);
    });
  });

  describe("organization isolation", () => {
    it("a scope bound to another organization is what the repository receives", async () => {
      const orgB = scopeOf("all", [], 2);
      const { service, repository } = makeService(orgB);
      await service.getChart({});
      const passed = repository.findVisibleMembers.mock
        .calls[0]![0] as TeamScope;
      expect(passed.organizationId).toBe(2);
    });

    it("an employee outside the caller's scope is a 404 for the subtree root", async () => {
      const { service, repository } = makeService(scopeOf("team", [1]));
      // Only team 1 members are visible; employee 50 is someone else's.
      repository.findVisibleMembers.mockResolvedValue([row(1, null)]);
      await expect(
        service.getChart({ rootEmployeeId: 50 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it("direct reports of an out-of-scope manager are a 404, not an empty list", async () => {
      const { service, repository } = makeService(scopeOf("own"));
      repository.findVisibleById.mockResolvedValue(null);
      await expect(service.directReports(50)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.findVisibleDirectReports).not.toHaveBeenCalled();
    });
  });

  describe("getChart", () => {
    it("returns [] for an empty organization", async () => {
      const { service } = makeService(scopeOf("all"));
      await expect(service.getChart({})).resolves.toEqual([]);
    });

    it("builds the nested tree from the visible members", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      repository.findVisibleMembers.mockResolvedValue([
        row(1, null),
        row(2, 1),
      ]);
      const chart = await service.getChart({});
      expect(chart).toHaveLength(1);
      expect(chart[0]!.children[0]!.id).toBe(2);
    });

    it("defaults depth to 10 levels when none is given", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      const chain = [row(1, null)];
      for (let i = 2; i <= 12; i++) chain.push(row(i, i - 1));
      repository.findVisibleMembers.mockResolvedValue(chain);
      const chart = await service.getChart({});
      let levels = 0;
      let cur = chart;
      while (cur.length) {
        levels++;
        cur = cur[0]!.children;
      }
      expect(levels).toBe(10);
    });

    it("passes the department filter to the repository", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      await service.getChart({ departmentId: 7 });
      expect(repository.findVisibleMembers.mock.calls[0]![1]).toBe(7);
    });

    it("returns only the subtree when rootEmployeeId is visible", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      repository.findVisibleMembers.mockResolvedValue([
        row(1, null),
        row(2, 1),
        row(3, 2),
      ]);
      const chart = await service.getChart({ rootEmployeeId: 2 });
      expect(chart.map((n) => n.id)).toEqual([2]);
      expect(chart[0]!.children.map((n) => n.id)).toEqual([3]);
    });
  });

  describe("directReports", () => {
    it("returns visible reports with visible counts from one grouped query", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      repository.findVisibleById.mockResolvedValue(row(1, null));
      repository.findVisibleDirectReports.mockResolvedValue([
        row(2, 1),
        row(3, 1),
      ]);
      repository.countVisibleDirectReports.mockResolvedValue(new Map([[2, 4]]));

      const reports = await service.directReports(1);

      expect(reports.map((r) => r.id)).toEqual([2, 3]);
      expect(reports[0]!.directReportCount).toBe(4);
      expect(reports[1]!.directReportCount).toBe(0);
      expect(repository.countVisibleDirectReports).toHaveBeenCalledTimes(1);
    });

    it("returns an empty list for a visible employee with no reports", async () => {
      const { service, repository } = makeService(scopeOf("all"));
      repository.findVisibleById.mockResolvedValue(row(1, null));
      await expect(service.directReports(1)).resolves.toEqual([]);
    });
  });
});
