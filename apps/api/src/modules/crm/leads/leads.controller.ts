import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { LeadsService } from "./leads.service.js";
import {
  ConvertLeadDto,
  CreateLeadDto,
  QueryLeadDto,
  UpdateLeadDto,
} from "./dto/lead.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Leads.tsx +
 * domain/LeadConvertDialog.tsx (RTDB `crm/leads`). Delete is soft-delete,
 * gated behind the write permission — see the catalog.ts note on
 * crm.lead.write for why (legacy gates it behind "CRM Admin only", this
 * app has no separate CRM-admin role concept yet). Convert does not create
 * a Deal/Opportunity — see dto/lead.dto.ts. */
@ApiTags("crm-leads")
@Controller("crm/leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequireScopedPermission("crm.lead.read")
  @ApiOperation({
    summary:
      "List leads in the caller's scope (search across company/prospect/email/phone, filter by status/owner/source/industry/city/country)",
  })
  findAll(@Paginate(QueryLeadDto) query: QueryLeadDto) {
    return this.leads.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("crm.lead.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leads.findOne(id);
  }

  @Post()
  @RequireScopedPermission("crm.lead.write")
  @ApiOperation({ summary: "Create a lead" })
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("crm.lead.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopedPermission("crm.lead.write")
  @ApiOperation({ summary: "Soft-delete a lead" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.leads.remove(id);
  }

  @Post(":id/convert")
  @RequireScopedPermission("crm.lead.write")
  @ApiOperation({
    summary:
      "Convert a lead into (or link it to) an Account, optionally creating a Contact. Does not create a Deal/Opportunity.",
  })
  convert(@Param("id", ParseIntPipe) id: number, @Body() dto: ConvertLeadDto) {
    return this.leads.convert(id, dto);
  }
}
