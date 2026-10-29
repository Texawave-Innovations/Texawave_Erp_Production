import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { UpdateProposalSettingsDto } from "./dto/settings.dto.js";
import { ProposalSettingsService } from "./proposal-settings.service.js";

@ApiTags("Proposal Settings")
@ApiBearerAuth()
@Controller("proposals/settings")
export class ProposalSettingsController {
  constructor(private readonly service: ProposalSettingsService) {}

  @Get()
  @RequirePermission("projects.proposals.read")
  @ApiOperation({ summary: "Get proposal branding and numbering settings" })
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermission("projects.proposals.manage_settings")
  @ApiOperation({ summary: "Update proposal branding and numbering settings" })
  update(@Body() dto: UpdateProposalSettingsDto) {
    return this.service.update(dto);
  }
}
