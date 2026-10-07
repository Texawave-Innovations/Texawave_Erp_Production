import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { EmployeesService } from "../../hr/employees/employees.service.js";
import { OnboardingProgressService } from "./onboarding-progress.service.js";

/** HR's read-only view of one employee's onboarding. Lives here, not in the
 * hr/ module, because the progress data comes from the profile tables and
 * the profile module already depends on the employees module (no cycle). */
@ApiTags("hr-onboarding")
@Controller("hr/employees")
export class HrOnboardingController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly progress: OnboardingProgressService,
  ) {}

  @Get(":id/onboarding")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary:
      "Onboarding progress of an employee in the caller's scope: status and missing items",
  })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    // Scope check happens inside findOne: out-of-scope ids are a 404.
    const employee = await this.employees.findOne(id);
    const missing = await this.progress.missingFor(id);
    return {
      employeeId: employee.id,
      onboardingStatus: employee.onboardingStatus,
      missing,
    };
  }
}
