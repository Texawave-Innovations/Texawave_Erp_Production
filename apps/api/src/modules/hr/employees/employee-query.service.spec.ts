import { describe, expect, it, vi } from "vitest";
import { NotAnEmployeeException } from "./employee.exceptions.js";
import type { EmployeeRow } from "./employee-mappers.js";
import { EmployeeQueryService } from "./employee-query.service.js";

const ORG = { organizationId: 1 };

const row = {
  id: 5,
  employeeCode: "EMP-000005",
  fullName: "Asha Verma",
  status: "ACTIVE",
  onboardingStatus: "PENDING_PROFILE",
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
  userId: 9,
  workEmail: "asha@example.com",
  phone: "+91 98765 43210",
  isActive: true,
  version: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as EmployeeRow;

function makeService(found: EmployeeRow | null) {
  const repository = {
    findByUserId: vi.fn().mockResolvedValue(found),
    markOnboardingComplete: vi.fn().mockResolvedValue(undefined),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG),
    getUserId: vi.fn().mockReturnValue(9),
  };
  const service = new EmployeeQueryService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

describe("EmployeeQueryService", () => {
  describe("getCurrentEmployee", () => {
    it("resolves the employee from the JWT user id within the org scope", async () => {
      const { service, repository } = makeService(row);

      const detail = await service.getCurrentEmployee();

      expect(repository.findByUserId).toHaveBeenCalledWith(ORG, 9);
      expect(detail).toMatchObject({
        id: 5,
        employeeCode: "EMP-000005",
        dateOfJoining: "2026-01-05",
        hasLogin: true,
        userId: 9,
        workEmail: "asha@example.com",
        version: 3,
      });
    });

    it("throws NOT_AN_EMPLOYEE when the login is not linked to an employee", async () => {
      const { service } = makeService(null);
      await expect(service.getCurrentEmployee()).rejects.toBeInstanceOf(
        NotAnEmployeeException,
      );
    });
  });

  describe("completeOnboarding", () => {
    it("marks the CURRENT employee's onboarding complete", async () => {
      const { service, repository } = makeService(row);
      await service.completeOnboarding();
      expect(repository.markOnboardingComplete).toHaveBeenCalledWith(ORG, 5);
    });

    it("does nothing when the login has no employee", async () => {
      const { service, repository } = makeService(null);
      await expect(service.completeOnboarding()).rejects.toBeInstanceOf(
        NotAnEmployeeException,
      );
      expect(repository.markOnboardingComplete).not.toHaveBeenCalled();
    });
  });
});
