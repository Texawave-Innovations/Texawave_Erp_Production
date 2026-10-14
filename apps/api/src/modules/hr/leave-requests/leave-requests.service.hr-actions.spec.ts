import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { LeaveOwnViaSelfServiceException } from "./leave-requests.repository.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

const ORG = { organizationId: 1 };

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [2] };
  const repository = {
    employeeVisible: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue({ id: 5 }),
    hrCancel: vi.fn(),
    findAwaiting: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const employees = {
    findCurrentEmployeeOrNull: vi.fn().mockResolvedValue({ id: 77 }),
  };
  const notifier = { leaveChanged: vi.fn().mockResolvedValue(undefined) };
  const service = new LeaveRequestsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
    notifier as never,
  );
  return { service, repository, teamContext, teamScope, notifier };
}

const body = {
  employeeId: 55,
  leaveTypeId: 2,
  startDate: "2026-10-05",
  endDate: "2026-10-05",
  reason: "called in sick",
};

describe("LeaveRequestsService — HR actions", () => {
  describe("createOnBehalf()", () => {
    it("resolves the create permission and submits as the caller, for the named employee", async () => {
      const { service, repository, teamContext, notifier } =
        makeService("team");
      await expect(service.createOnBehalf(body as never)).resolves.toEqual({
        id: 5,
      });
      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.leave_request.create",
      );
      expect(repository.create).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ employeeId: 55, leaveTypeId: 2 }),
        42,
        "submit_on_behalf",
      );
      expect(notifier.leaveChanged).toHaveBeenCalledWith(5, {
        kind: "submitted",
        onBehalf: true,
        resubmitted: false,
      });
    });

    it("refuses .own without looking anything up", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.createOnBehalf(body as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.employeeVisible).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("404s for an employee outside the caller's scope", async () => {
      const { service, repository } = makeService("team");
      repository.employeeVisible.mockResolvedValue(false);
      await expect(
        service.createOnBehalf(body as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("sends the caller's own leave to self-service", async () => {
      const { service, repository } = makeService("all");
      await expect(
        service.createOnBehalf({ ...body, employeeId: 77 } as never),
      ).rejects.toBeInstanceOf(LeaveOwnViaSelfServiceException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("hrCancel()", () => {
    it("resolves the cancel permission and tells the employee", async () => {
      const { service, repository, teamContext, teamScope, notifier } =
        makeService("team");
      repository.hrCancel.mockResolvedValue({
        view: { id: 3, status: "CANCELLED" },
        previous: "APPROVED",
      });
      await expect(
        service.hrCancel(3, { note: "back at work" } as never),
      ).resolves.toEqual({ id: 3, status: "CANCELLED" });
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.leave.cancel");
      expect(repository.hrCancel).toHaveBeenCalledWith(
        teamScope,
        3,
        "back at work",
        42,
      );
      expect(notifier.leaveChanged).toHaveBeenCalledWith(3, {
        kind: "cancelled",
        byHr: true,
        wasApproved: true,
      });
    });

    it("refuses .own and 404s outside scope", async () => {
      const own = makeService("own");
      await expect(
        own.service.hrCancel(3, { note: "x" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(own.repository.hrCancel).not.toHaveBeenCalled();

      const team = makeService("team");
      team.repository.hrCancel.mockResolvedValue(null);
      await expect(
        team.service.hrCancel(3, { note: "x" } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(team.notifier.leaveChanged).not.toHaveBeenCalled();
    });
  });

  it("findAwaiting() queries with the approve scope and the caller", async () => {
    const { service, repository, teamContext, teamScope } = makeService("own");
    await service.findAwaiting({ page: 1, limit: 20 } as never);
    expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.leave.approve");
    expect(repository.findAwaiting).toHaveBeenCalledWith(
      teamScope,
      42,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.anything(),
      expect.anything(),
    );
  });
});
