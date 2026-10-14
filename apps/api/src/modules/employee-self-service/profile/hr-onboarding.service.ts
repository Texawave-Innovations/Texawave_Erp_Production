import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { EmployeesService } from "../../hr/employees/employees.service.js";
import { OnboardingProgressService } from "./onboarding-progress.service.js";

/** HR's side of onboarding: progress, and the review of a submitted profile.
 * The decision itself (scope, self-review refusal, state rules, audit) lives
 * in the employees module; this adds the completeness check, which needs the
 * profile tables this module owns. */
@Injectable()
export class HrOnboardingService {
  constructor(
    private readonly employees: EmployeesService,
    private readonly progress: OnboardingProgressService,
  ) {}

  async progressFor(id: number) {
    // Scope check happens inside findOne: out-of-scope ids are a 404.
    const employee = await this.employees.findOne(id);
    const missing = await this.progress.missingFor(id);
    return {
      employeeId: employee.id,
      onboardingStatus: employee.onboardingStatus,
      onboardingReviewStatus: employee.onboardingReviewStatus,
      onboardingSubmittedAt: employee.onboardingSubmittedAt,
      onboardingReviewedAt: employee.onboardingReviewedAt,
      onboardingReviewNote: employee.onboardingReviewNote,
      missing,
    };
  }

  /** A profile is approved only when nothing required is missing — HR may
   * have removed a document or detail since the employee submitted. */
  async approve(id: number, note?: string) {
    // Visibility first, so an out-of-scope id is a 404 before anything else.
    await this.employees.findOne(id);
    const missing = await this.progress.missingFor(id);
    if (missing.length > 0) {
      throw new BusinessRuleViolationException(
        `The profile is incomplete: ${missing.join(", ")}`,
        "ONBOARDING_INCOMPLETE",
      );
    }
    return this.employees.approveOnboarding(id, note);
  }

  sendBack(id: number, note: string) {
    return this.employees.sendBackOnboarding(id, note);
  }
}
