import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { UpdateOrganizationSettingsDto } from "./dto/update-organization-settings.dto.js";
import { OrganizationSettingsService } from "./organization-settings.service.js";

@ApiTags("settings-organization")
@Controller("settings/organization")
export class OrganizationSettingsController {
  constructor(private readonly service: OrganizationSettingsService) {}

  @Get()
  @RequirePermission("settings.general.read")
  @ApiOperation({
    summary: "Get organization settings and regional configuration",
  })
  getSettings() {
    return this.service.getSettings();
  }

  @Patch()
  @RequirePermission("settings.general.update")
  @ApiOperation({
    summary: "Update organization settings, regional formats and base currency",
  })
  updateSettings(@Body() dto: UpdateOrganizationSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
