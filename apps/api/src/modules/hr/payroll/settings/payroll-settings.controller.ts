import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../../common/decorators/require-permission.decorator.js";
import {
  SalarySplitQueryDto,
  UpdatePayrollSettingsDto,
} from "./dto/payroll-settings.dto.js";
import { PayrollSettingsService } from "./payroll-settings.service.js";

/** Organization-wide payroll rules: not employee data, so exact (unscoped)
 * permissions. The split preview is for whoever sets salaries. */
@ApiTags("hr-payroll-settings")
@Controller("hr/payroll/settings")
export class PayrollSettingsController {
  constructor(private readonly settings: PayrollSettingsService) {}

  @Get()
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({
    summary:
      "Salary auto-split percentages and PF/ESI limits (defaults until first saved)",
  })
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({
    summary:
      "Change payroll settings (partial; requires the current version). Applies to payroll runs from now on",
  })
  update(@Body() dto: UpdatePayrollSettingsDto) {
    return this.settings.update(dto);
  }

  @Get("salary-split")
  @RequireScopedPermission("hr.salary.write")
  @ApiOperation({
    summary: "Preview how a gross monthly salary splits under the settings",
  })
  previewSplit(@Query() query: SalarySplitQueryDto) {
    return this.settings.previewSplit(query.grossMonthly);
  }
}
