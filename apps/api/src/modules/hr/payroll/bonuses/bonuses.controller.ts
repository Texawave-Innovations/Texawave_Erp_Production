import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import { BonusesService } from "./bonuses.service.js";
import {
  CreateBonusDto,
  CreateGratuityDto,
  DecideBonusDto,
  GratuityQueryDto,
  QueryBonusDto,
  StatutoryBonusDto,
} from "./dto/bonus.dto.js";

@ApiTags("hr-bonuses")
@Controller("hr/bonuses")
export class BonusesController {
  constructor(private readonly service: BonusesService) {}

  @Post()
  @RequireScopedPermission("hr.bonus.write")
  @ApiOperation({ summary: "Create an employee bonus record" })
  create(@Body() dto: CreateBonusDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireScopedPermission("hr.bonus.read")
  @ApiOperation({ summary: "List bonuses with filtering and pagination" })
  findAll(@Paginate(QueryBonusDto) query: QueryBonusDto) {
    return this.service.findAll(query);
  }

  @Post("statutory")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.bonus.write")
  @ApiOperation({
    summary:
      "Statutory bonus for a financial year from finalized payroll (preview; create: raise PENDING bonuses). Org-wide (.all)",
  })
  statutory(@Body() dto: StatutoryBonusDto) {
    return this.service.statutory(dto);
  }

  @Get("gratuity/:employeeId")
  @RequireScopedPermission("hr.bonus.read")
  @ApiOperation({ summary: "Gratuity due to an employee as of a date" })
  gratuity(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Query() query: GratuityQueryDto,
  ) {
    return this.service.gratuityFor(employeeId, query.asOf);
  }

  @Post("gratuity")
  @RequireScopedPermission("hr.bonus.write")
  @ApiOperation({
    summary: "Raise the calculated gratuity as a GRATUITY bonus (PENDING)",
  })
  createGratuity(@Body() dto: CreateGratuityDto) {
    return this.service.createGratuity(dto);
  }

  @Get(":id")
  @RequireScopedPermission("hr.bonus.read")
  @ApiOperation({ summary: "Get bonus details by id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(":id/decide")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.bonus.approve")
  @ApiOperation({ summary: "Approve or reject a bonus" })
  decide(@Param("id", ParseIntPipe) id: number, @Body() dto: DecideBonusDto) {
    return this.service.decide(id, dto);
  }
}
