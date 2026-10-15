import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CompanyProfileService } from "./company-profile.service.js";
import { UpsertCompanyProfileDto } from "./dto/company-profile.dto.js";

/** Sales master list → company profile (the seller block on documents). */
@ApiTags("sales-master-list")
@Controller("sales/master/company-profile")
export class CompanyProfileController {
  constructor(private readonly profile: CompanyProfileService) {}

  @Get()
  @RequirePermission("sales.master.read")
  @ApiOperation({ summary: "The company profile, or null if not set up" })
  find() {
    return this.profile.find();
  }

  @Put()
  @RequirePermission("sales.master.write")
  @ApiOperation({
    summary: "Create or replace the company profile",
  })
  upsert(@Body() dto: UpsertCompanyProfileDto) {
    return this.profile.upsert(dto);
  }
}
