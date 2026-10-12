import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { PayslipsService } from "./payslips.service.js";

const ORG_SCOPE = { organizationId: 1 };
const USER_ID = 42;
const QUERY = { page: 2, limit: 10 };

/** A repository row as returned with the onboarding bank relation joined. */
function row(id: number) {
  return {
    id,
    netPayable: "1000.00",
    employee: {
      id: 7,
      bankDetail: {
        bankName: "State Bank",
        accountNumberMasked: "********1234",
        ifsc: "SBIN0000001",
        deletedAt: null,
      },
      employeeGovernmentId: { panNumber: "ABCDE1234F", deletedAt: null },
    },
  };
}

const MASKED_EMPLOYEE = {
  id: 7,
  bankDetails: {
    bankName: "State Bank",
    accountNumber: "********1234",
    ifscCode: "SBIN0000001",
    panNumber: "******234F",
  },
};

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = {
    level,
    userId: USER_ID,
    organizationId: 1,
    teamIds: level === "team" ? [3] : [],
  };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [row(1), row(2)], total: 25 }),
    findById: vi.fn().mockResolvedValue(row(1)),
    generateForPeriod: vi.fn().mockResolvedValue([row(1)]),
    findMine: vi.fn().mockResolvedValue({ items: [row(3)], total: 1 }),
    findMineById: vi.fn().mockResolvedValue(row(3)),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employeeQuery = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 7 }),
  };
  const service = new PayslipsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employeeQuery as never,
  );
  return { service, repository, teamContext, teamScope, employeeQuery };
}

describe("PayslipsService", () => {
  describe("findMany", () => {
    it("lists team-scoped payslips with bank details masked", async () => {
      const { service, repository, teamContext, teamScope } =
        makeService("team");

      const result = await service.findMany(QUERY as never);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payslip.read");
      expect(repository.findMany).toHaveBeenCalledWith(teamScope, QUERY, QUERY);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.items.map((i) => i.id)).toEqual([1, 2]);
      expect(result.items[0]!.employee).toEqual(MASKED_EMPLOYEE);
    });
  });

  describe("findById", () => {
    it("returns the masked payslip", async () => {
      const { service, repository, teamScope } = makeService();
      const result = await service.findById(1);
      expect(repository.findById).toHaveBeenCalledWith(teamScope, 1);
      expect(result.employee).toEqual(MASKED_EMPLOYEE);
      expect(result.employee).not.toHaveProperty("bankDetail");
    });

    it("throws not found when out of scope or missing", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("generateForPeriod", () => {
    it("generates org-wide with the caller as actor and masks the result", async () => {
      const { service, repository, teamContext } = makeService("all");

      const result = await service.generateForPeriod(10);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payroll.write");
      expect(repository.generateForPeriod).toHaveBeenCalledWith(
        ORG_SCOPE,
        10,
        USER_ID,
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.employee).toEqual(MASKED_EMPLOYEE);
    });

    it.each(["team", "own"] as const)(
      "refuses a .%s grant before touching the repository",
      async (level) => {
        const { service, repository } = makeService(level);
        await expect(service.generateForPeriod(10)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(repository.generateForPeriod).not.toHaveBeenCalled();
      },
    );

    it("throws not found when the period does not exist", async () => {
      const { service, repository } = makeService("all");
      repository.generateForPeriod.mockResolvedValue(null);
      await expect(service.generateForPeriod(99)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("findMine", () => {
    it("lists only the current employee's payslips, masked", async () => {
      const { service, repository, teamContext } = makeService("own");

      const result = await service.findMine(QUERY as never);

      expect(repository.findMine).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        QUERY,
        QUERY,
      );
      expect(teamContext.resolveScope).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.items[0]!.employee).toEqual(MASKED_EMPLOYEE);
    });

    it("propagates a failure to resolve the current employee", async () => {
      const { service, employeeQuery, repository } = makeService("own");
      employeeQuery.getCurrentEmployee.mockRejectedValue(
        new ResourceNotFoundException("Employee", "me"),
      );
      await expect(service.findMine(QUERY as never)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.findMine).not.toHaveBeenCalled();
    });
  });

  describe("findMineById", () => {
    it("returns the employee's own payslip, masked", async () => {
      const { service, repository } = makeService("own");
      const result = await service.findMineById(3);
      expect(repository.findMineById).toHaveBeenCalledWith(ORG_SCOPE, 7, 3);
      expect(result.id).toBe(3);
      expect(result.employee).toEqual(MASKED_EMPLOYEE);
    });

    it("throws not found for someone else's payslip", async () => {
      const { service, repository } = makeService("own");
      repository.findMineById.mockResolvedValue(null);
      await expect(service.findMineById(4)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
