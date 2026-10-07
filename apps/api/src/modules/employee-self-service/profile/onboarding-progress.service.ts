import { Injectable } from "@nestjs/common";
import { missingOnboardingItems } from "./onboarding-completeness.js";
import { ProfileRepository } from "./profile.repository.js";

/** Reads one employee's onboarding records and lists what is still missing.
 * Takes an employee id, not "who am I", so it serves both the employee's own
 * submit check and HR's progress view — callers must scope the id first. */
@Injectable()
export class OnboardingProgressService {
  constructor(private readonly repository: ProfileRepository) {}

  async missingFor(employeeId: number): Promise<string[]> {
    const [
      personal,
      permanentAddress,
      presentAddress,
      bank,
      governmentIds,
      documents,
    ] = await Promise.all([
      this.repository.getPersonal(employeeId),
      this.repository.getAddress(employeeId, "PERMANENT"),
      this.repository.getAddress(employeeId, "PRESENT"),
      this.repository.getBank(employeeId),
      this.repository.getGovernmentIds(employeeId),
      this.repository.listDocuments(employeeId),
    ]);

    return missingOnboardingItems({
      personal,
      permanentAddress,
      presentAddress,
      bank,
      governmentIds,
      documents,
    });
  }
}
