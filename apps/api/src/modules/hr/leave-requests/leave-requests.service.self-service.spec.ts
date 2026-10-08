import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { NotAnEmployeeException } from "../employees/employee.exceptions.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

const ORG = { organizationId: 1 };
const TODAY = "2026-03-15";

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [2] };
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 31 }),
    findOne: vi.fn(),
    decide: vi.fn(),
    employeeVisible: vi.fn(),
    setEntitlement: vi.fn(),
    findMine: vi.fn().mockResolvedValue({ items: [{ id: 4 }], total: 1 }),
    findMineOne: vi.fn(),
    cancel: vi.fn(),
    resubmit: vi.fn(),
    balanceSheet: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const service = new LeaveRequestsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, repository, teamContext, employees, teamScope };
}

describe("LeaveRequestsService (scope reads, balances, self-service)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("HR view", () => {
    it("findAll() wraps the repository page in a paginated response", async () => {
      const { service } = makeService("team");
      const res = await service.findAll({ page: 2, limit: 10 } as never);
      expect(res).toBeInstanceOf(PaginatedResponseDto);
      expect(res).toMatchObject({
        items: [{ id: 1 }],
        total: 31,
        page: 2,
        limit: 10,
        totalPages: 4,
      });
    });

    it("findOne() returns the row found within the read scope", async () => {
      const { service, repository, teamScope } = makeService("team");
      repository.findOne.mockResolvedValue({ id: 9, status: "PENDING" });
      await expect(service.findOne(9)).resolves.toEqual({
        id: 9,
        status: "PENDING",
      });
      expect(repository.findOne).toHaveBeenCalledWith(teamScope, 9);
    });

    it("approve() resolves the approve permission, not the read one", async () => {
      const { service, repository, teamContext } = makeService("team");
      repository.decide.mockResolvedValue({ id: 1, status: "APPROVED" });
      await expect(service.approve(1, {} as never)).resolves.toEqual({
        id: 1,
        status: "APPROVED",
      });
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.leave.approve");
    });
  });

  describe("hrBalances()", () => {
    it("404s for an employee outside the caller's scope without reading balances", async () => {
      const { service, repository, teamScope } = makeService("team");
      repository.employeeVisible.mockResolvedValue(false);
      await expect(
        service.hrBalances({ employeeId: 55 } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.employeeVisible).toHaveBeenCalledWith(teamScope, 55);
      expect(repository.balanceSheet).not.toHaveBeenCalled();
    });

    it("defaults the year to the current one and passes today's date", async () => {
      const { service, repository } = makeService("all");
      repository.employeeVisible.mockResolvedValue(true);
      repository.balanceSheet.mockResolvedValue([{ leaveTypeId: 1 }]);
      await expect(
        service.hrBalances({ employeeId: 55 } as never),
      ).resolves.toEqual([{ leaveTypeId: 1 }]);
      expect(repository.balanceSheet).toHaveBeenCalledWith(
        ORG,
        55,
        2026,
        TODAY,
      );
    });

    it("uses an explicit year when given", async () => {
      const { service, repository } = makeService("all");
      repository.employeeVisible.mockResolvedValue(true);
      repository.balanceSheet.mockResolvedValue([]);
      await service.hrBalances({ employeeId: 55, year: 2024 } as never);
      expect(repository.balanceSheet).toHaveBeenCalledWith(
        ORG,
        55,
        2024,
        TODAY,
      );
    });

    it("404s when the repository finds no employee for the balance sheet", async () => {
      const { service, repository } = makeService("all");
      repository.employeeVisible.mockResolvedValue(true);
      repository.balanceSheet.mockResolvedValue(null);
      await expect(
        service.hrBalances({ employeeId: 55 } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  it("setEntitlement() writes org-wide with the acting user", async () => {
    const { service, repository, teamContext } = makeService("own");
    repository.setEntitlement.mockResolvedValue({ id: 3 });
    await expect(
      service.setEntitlement(55, 2, 2026, { annualEntitlement: 12 } as never),
    ).resolves.toEqual({ id: 3 });
    expect(repository.setEntitlement).toHaveBeenCalledWith(
      ORG,
      { employeeId: 55, leaveTypeId: 2, year: 2026, annualEntitlement: 12 },
      42,
    );
    expect(teamContext.resolveScope).not.toHaveBeenCalled();
  });

  describe("self-service", () => {
    it("findMine() returns a paginated response of the employee's requests", async () => {
      const { service } = makeService();
      const res = await service.findMine({ page: 1, limit: 20 } as never);
      expect(res).toBeInstanceOf(PaginatedResponseDto);
      expect(res).toMatchObject({ items: [{ id: 4 }], total: 1, page: 1 });
    });

    it("findMineOne() looks up by the current employee and 404s otherwise", async () => {
      const { service, repository } = makeService();
      repository.findMineOne.mockResolvedValueOnce({ id: 4 });
      await expect(service.findMineOne(4)).resolves.toEqual({ id: 4 });
      expect(repository.findMineOne).toHaveBeenCalledWith(ORG, 77, 4);

      repository.findMineOne.mockResolvedValueOnce(null);
      await expect(service.findMineOne(5)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("cancelMine() cancels as the current employee as of today", async () => {
      const { service, repository } = makeService();
      repository.cancel.mockResolvedValue({ id: 4, status: "CANCELLED" });
      await expect(
        service.cancelMine(4, { note: "plans changed" } as never),
      ).resolves.toEqual({ id: 4, status: "CANCELLED" });
      expect(repository.cancel).toHaveBeenCalledWith(
        ORG,
        77,
        4,
        "plans changed",
        42,
        TODAY,
      );
    });

    it("cancelMine() 404s when the request is not the caller's", async () => {
      const { service, repository } = makeService();
      repository.cancel.mockResolvedValue(null);
      await expect(service.cancelMine(4, {} as never)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("resubmitMine() resubmits as the current employee as of today", async () => {
      const { service, repository } = makeService();
      repository.resubmit.mockResolvedValue({ id: 4, status: "PENDING" });
      await expect(service.resubmitMine(4)).resolves.toEqual({
        id: 4,
        status: "PENDING",
      });
      expect(repository.resubmit).toHaveBeenCalledWith(ORG, 77, 4, 42, TODAY);
    });

    it("resubmitMine() 404s when nothing was resubmitted", async () => {
      const { service, repository } = makeService();
      repository.resubmit.mockResolvedValue(null);
      await expect(service.resubmitMine(4)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("myBalances() reads the current employee's sheet, defaulting the year", async () => {
      const { service, repository } = makeService();
      repository.balanceSheet.mockResolvedValue([{ leaveTypeId: 1 }]);
      await expect(service.myBalances({} as never)).resolves.toEqual([
        { leaveTypeId: 1 },
      ]);
      expect(repository.balanceSheet).toHaveBeenCalledWith(
        ORG,
        77,
        2026,
        TODAY,
      );

      await service.myBalances({ year: 2025 } as never);
      expect(repository.balanceSheet).toHaveBeenLastCalledWith(
        ORG,
        77,
        2025,
        TODAY,
      );
    });

    it("propagates NOT_AN_EMPLOYEE and never touches the repository", async () => {
      const { service, repository, employees } = makeService();
      employees.getCurrentEmployee.mockRejectedValue(
        new NotAnEmployeeException(),
      );
      await expect(service.myBalances({} as never)).rejects.toBeInstanceOf(
        NotAnEmployeeException,
      );
      await expect(service.resubmitMine(1)).rejects.toBeInstanceOf(
        NotAnEmployeeException,
      );
      expect(repository.balanceSheet).not.toHaveBeenCalled();
      expect(repository.resubmit).not.toHaveBeenCalled();
    });
  });
});
