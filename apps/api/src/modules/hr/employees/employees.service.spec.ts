import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import type { EmployeeRow } from "./employee-mappers.js";
import { EmployeesService } from "./employees.service.js";

const ORG = { organizationId: 1 };
const scopeOf = (
  level: TeamScope["level"],
  teamIds: number[] = [],
): TeamScope => ({
  level,
  userId: 9,
  organizationId: 1,
  teamIds,
});

const row = (over: Partial<EmployeeRow> = {}): EmployeeRow =>
  ({
    id: 5,
    employeeCode: "EMP-000005",
    fullName: "Asha Verma",
    status: "ACTIVE",
    dateOfJoining: new Date("2026-01-05T00:00:00Z"),
    dateOfExit: null,
    exitReason: null,
    team: { id: 2, name: "T2" },
    department: null,
    designation: { id: 1, name: "Engineer" },
    employmentType: { id: 1, name: "Permanent" },
    workLocation: null,
    reportsTo: null,
    reportsToId: null,
    userId: null,
    workEmail: "asha@example.com",
    phone: "+91 98765 43210",
    isActive: true,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as EmployeeRow;

function makeService(level: TeamScope["level"], teamIds: number[] = []) {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findStatusHistory: vi.fn(),
  };
  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue(scopeOf(level, teamIds)),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(9),
  };
  const service = new EmployeesService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );
  return { service, repository, teamContext };
}

const newEmployee = {
  fullName: "New Person",
  teamId: 2,
  designationId: 1,
  employmentTypeId: 1,
  dateOfJoining: "2026-10-01",
};

describe("EmployeesService", () => {
  describe("reads use the resolved scope and never widen it", () => {
    it("resolves hr.employee.read and passes that scope to the repository", async () => {
      const { service, repository, teamContext } = makeService("team", [2]);
      repository.findMany.mockResolvedValue({ items: [], total: 0 });
      await service.findAll({ page: 1, limit: 20, skip: 0 } as never);
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.employee.read");
      expect(repository.findMany.mock.calls[0]?.[0]).toEqual(
        scopeOf("team", [2]),
      );
    });

    it("returns list rows without phone, e-mail or exit reason", async () => {
      const { service, repository } = makeService("all");
      repository.findMany.mockResolvedValue({ items: [row()], total: 1 });
      const page = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      const item = page.items[0] as unknown as Record<string, unknown>;
      expect(item).not.toHaveProperty("phone");
      expect(item).not.toHaveProperty("workEmail");
      expect(item).not.toHaveProperty("exitReason");
      expect(item).toMatchObject({
        employeeCode: "EMP-000005",
        hasLogin: false,
      });
    });

    it("findOne throws 404 (not 403) when the employee is outside the scope", async () => {
      const { service, repository } = makeService("team", [1]);
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(5)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("findOne detail includes contact details for a visible employee", async () => {
      const { service, repository } = makeService("all");
      repository.findOne.mockResolvedValue(row());
      await expect(service.findOne(5)).resolves.toMatchObject({
        phone: "+91 98765 43210",
        workEmail: "asha@example.com",
        version: 3,
        dateOfJoining: "2026-01-05",
      });
    });
  });

  describe("create", () => {
    it("is refused for an .own writer without touching the repository", async () => {
      const { service, repository } = makeService("own");
      await expect(service.create(newEmployee as never)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("lets a .team writer create only in their own team", async () => {
      const { service, repository } = makeService("team", [2]);
      repository.create.mockResolvedValue(row());
      await service.create(newEmployee as never);
      expect(repository.create).toHaveBeenCalledTimes(1);

      await expect(
        service.create({ ...newEmployee, teamId: 3 } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it("lets an .all writer create anywhere, attributing the write to the caller", async () => {
      const { service, repository } = makeService("all");
      repository.create.mockResolvedValue(row());
      await service.create({ ...newEmployee, teamId: 77 } as never);
      expect(repository.create).toHaveBeenCalledWith(ORG, expect.anything(), 9);
    });
  });

  describe("update", () => {
    it("is refused for an .own writer (self-service edits are not built)", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.update(5, { version: 1, phone: "12345678" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it.each([
      "teamId",
      "departmentId",
      "designationId",
      "employmentTypeId",
      "dateOfJoining",
    ])("a .team writer may not change %s", async (field) => {
      const { service, repository } = makeService("team", [2]);
      await expect(
        service.update(5, {
          version: 1,
          [field]: field === "dateOfJoining" ? "2026-01-01" : 3,
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("a .team writer may change profile fields of their own team", async () => {
      const { service, repository } = makeService("team", [2]);
      repository.update.mockResolvedValue(row());
      await service.update(5, {
        version: 3,
        phone: "12345678",
        fullName: "New Name",
      } as never);
      expect(repository.update).toHaveBeenCalledWith(
        scopeOf("team", [2]),
        5,
        expect.objectContaining({ version: 3 }),
        9,
      );
    });

    it("an .all writer may change restricted fields", async () => {
      const { service, repository } = makeService("all");
      repository.update.mockResolvedValue(row());
      await expect(
        service.update(5, { version: 3, teamId: 4 } as never),
      ).resolves.toBeDefined();
    });

    it("404 when the repository reports the employee is not in scope", async () => {
      const { service, repository } = makeService("team", [2]);
      repository.update.mockResolvedValue(null);
      await expect(
        service.update(5, { version: 1, phone: "12345678" } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("statusHistory", () => {
    it("is only available for an employee the caller may read", async () => {
      const { service, repository } = makeService("team", [1]);
      repository.findOne.mockResolvedValue(null);
      await expect(
        service.statusHistory(5, { page: 1, limit: 20, skip: 0 } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.findStatusHistory).not.toHaveBeenCalled();
    });
  });
});
