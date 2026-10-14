import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import { ComplianceService } from "./compliance.service.js";
import {
  QueryContributionDto,
  UpdateEmployeeEsiProfileDto,
  UpdateEmployeePfProfileDto,
} from "./dto/compliance.dto.js";

@ApiTags("hr-compliance")
@Controller("hr/compliance")
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  // ---- PF ------------------------------------------------------------------

  @Get("pf/profiles/:employeeId")
  @RequireScopedPermission("hr.pf.read")
  @ApiOperation({ summary: "Get employee PF profile" })
  getPfProfile(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.service.getPfProfile(employeeId);
  }

  @Put("pf/profiles/:employeeId")
  @RequireScopedPermission("hr.pf.write")
  @ApiOperation({ summary: "Create or update employee PF profile" })
  updatePfProfile(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: UpdateEmployeePfProfileDto,
  ) {
    return this.service.updatePfProfile(employeeId, dto);
  }

  @Get("pf/contributions")
  @RequireScopedPermission("hr.pf.read")
  @ApiOperation({
    summary: "List PF contributions with filters and pagination",
  })
  findPfContributions(
    @Paginate(QueryContributionDto) query: QueryContributionDto,
  ) {
    return this.service.findPfContributions(query);
  }

  @Get("pf/contributions/:id")
  @RequireScopedPermission("hr.pf.read")
  @ApiOperation({ summary: "Get PF contribution by id" })
  findPfContributionById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findPfContributionById(id);
  }

  // ---- ESI -----------------------------------------------------------------

  @Get("esi/profiles/:employeeId")
  @RequireScopedPermission("hr.esi.read")
  @ApiOperation({ summary: "Get employee ESI profile" })
  getEsiProfile(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.service.getEsiProfile(employeeId);
  }

  @Put("esi/profiles/:employeeId")
  @RequireScopedPermission("hr.esi.write")
  @ApiOperation({ summary: "Create or update employee ESI profile" })
  updateEsiProfile(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: UpdateEmployeeEsiProfileDto,
  ) {
    return this.service.updateEsiProfile(employeeId, dto);
  }

  @Get("esi/contributions")
  @RequireScopedPermission("hr.esi.read")
  @ApiOperation({
    summary: "List ESI contributions with filters and pagination",
  })
  findEsiContributions(
    @Paginate(QueryContributionDto) query: QueryContributionDto,
  ) {
    return this.service.findEsiContributions(query);
  }

  @Get("esi/contributions/:id")
  @RequireScopedPermission("hr.esi.read")
  @ApiOperation({ summary: "Get ESI contribution by id" })
  findEsiContributionById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findEsiContributionById(id);
  }
}
