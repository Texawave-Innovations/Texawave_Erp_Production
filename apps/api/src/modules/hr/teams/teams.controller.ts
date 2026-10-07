import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { TeamsRepository } from "./teams.repository.js";

/** Read-only reference list for pickers. Any caller who can create employees
 * (`hr.employee.write`, any scope) may read it — team names are not personal data. */
@ApiTags("hr-teams")
@Controller("hr/teams")
export class TeamsController {
  constructor(
    private readonly repository: TeamsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @RequireScopedPermission("hr.employee.write")
  @ApiOperation({ summary: "Active teams in the current organization" })
  list() {
    return this.repository.findActive(this.tenantContext.getOrgScope());
  }
}
