import { ForbiddenException } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { ProfilesService } from "./profiles.service.js";

function makeService(level: "own" | "team" | "all" = "all") {
  const teamScope = { level, userId: 42, organizationId: 1, teamIds: [] };
  const repository = {
    findOne: vi.fn(),
    upsertProfile: vi.fn(),
    readSensitive: vi.fn(),
    upsertSensitive: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(teamScope) };
  const service = new ProfilesService(
    repository as never,
    tenantContext as never,
    teamContext as never,
  );
  return { service, repository, teamContext, teamScope };
}

describe("ProfilesService", () => {
  describe("profile reads", () => {
    it("resolves the read scope and answers not-found outside it", async () => {
      const { service, repository, teamContext, teamScope } =
        makeService("team");
      repository.findOne.mockResolvedValue(null);

      await expect(service.getProfile(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(teamContext.resolveScope).toHaveBeenCalledWith(
        "hr.employee_profile.read",
      );
      expect(repository.findOne).toHaveBeenCalledWith(teamScope, 9);
    });
  });

  describe("profile writes", () => {
    it("refuses an own-level holder before anything is written", async () => {
      const { service, repository } = makeService("own");
      await expect(
        service.updateProfile(3, { title: "Mr" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.upsertProfile).not.toHaveBeenCalled();
    });

    it("sends only the keys the request named; omitted fields are not touched", async () => {
      const { service, repository, teamScope } = makeService("team");
      repository.upsertProfile.mockResolvedValue({ employee: {} });

      await service.updateProfile(3, {
        fatherName: "R. Kumar",
        gender: null,
      } as never);

      expect(repository.upsertProfile).toHaveBeenCalledWith(
        teamScope,
        3,
        { fatherName: "R. Kumar", gender: null },
        42,
      );
    });

    it("normalises languages and stores a null flag as false", async () => {
      const { service, repository } = makeService("all");
      repository.upsertProfile.mockResolvedValue({ employee: {} });

      await service.updateProfile(3, {
        languages: [" Tamil", "tamil", "English "],
        isFresher: null,
        experienceYears: 4.5,
      } as never);

      expect(repository.upsertProfile.mock.calls[0]?.[2]).toEqual({
        languages: ["Tamil", "English"],
        isFresher: false,
        experienceYears: "4.5",
      });
    });

    it("maps an address DTO to the stored shape, and null clears it", async () => {
      const { service, repository } = makeService("all");
      repository.upsertProfile.mockResolvedValue({ employee: {} });

      await service.updateProfile(3, {
        presentAddress: {
          address: "12 Main St",
          city: "Chennai",
          state: "TN",
          pincode: "600020",
        },
        permanentAddress: null,
      } as never);

      expect(repository.upsertProfile.mock.calls[0]?.[2]).toEqual({
        presentAddress: {
          address: "12 Main St",
          area: undefined,
          district: undefined,
          city: "Chennai",
          state: "TN",
          pincode: "600020",
          country: undefined,
        },
        permanentAddress: null,
      });
    });

    it("answers not-found when the employee is outside the caller's scope", async () => {
      const { service, repository } = makeService("team");
      repository.upsertProfile.mockResolvedValue(null);
      await expect(
        service.updateProfile(99, { title: "Ms" } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });

  describe("sensitive record (organization-wide by permission)", () => {
    it("reads with the organization boundary, not a team scope", async () => {
      const { service, repository, teamContext } = makeService("all");
      repository.readSensitive.mockResolvedValue({ employeeId: 3 });

      await service.getSensitive(3);

      expect(repository.readSensitive).toHaveBeenCalledWith(
        { organizationId: 1 },
        3,
      );
      expect(teamContext.resolveScope).not.toHaveBeenCalled();
    });

    it("answers not-found for an employee outside the organization", async () => {
      const { service, repository } = makeService("all");
      repository.readSensitive.mockResolvedValue(null);
      await expect(service.getSensitive(9)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it("writes only the sensitive keys the request named, with the actor", async () => {
      const { service, repository } = makeService("all");
      repository.upsertSensitive.mockResolvedValue({ employeeId: 3 });

      await service.updateSensitive(3, {
        bankIfsc: "SBIN0001234",
        panNumber: null,
      } as never);

      expect(repository.upsertSensitive).toHaveBeenCalledWith(
        { organizationId: 1 },
        3,
        { bankIfsc: "SBIN0001234", panNumber: null },
        42,
      );
    });

    it("answers not-found on a sensitive write for an unknown employee", async () => {
      const { service, repository } = makeService("all");
      repository.upsertSensitive.mockResolvedValue(null);
      await expect(
        service.updateSensitive(9, { bankIfsc: "SBIN0001234" } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });
});
