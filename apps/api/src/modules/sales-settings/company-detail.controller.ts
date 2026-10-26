import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CompanyDetailService } from "./company-detail.service.js";
import { UpsertCompanyDetailDto } from "./dto/upsert-company-detail.dto.js";

/** Company tab of Sales Settings — a single-row settings form, not a list. */
@ApiTags("sales-settings-company-detail")
@Controller("sales-settings/company-detail")
export class CompanyDetailController {
  constructor(private readonly companyDetail: CompanyDetailService) {}

  @Get()
  @RequirePermission("sales_settings.company_detail.read")
  @ApiOperation({ summary: "Get the current organization's company details" })
  findOne() {
    return this.companyDetail.findOne();
  }

  @Put()
  @RequirePermission("sales_settings.company_detail.write")
  @ApiOperation({ summary: "Create or replace the company details" })
  upsert(@Body() dto: UpsertCompanyDetailDto) {
    return this.companyDetail.upsert(dto);
  }
}
