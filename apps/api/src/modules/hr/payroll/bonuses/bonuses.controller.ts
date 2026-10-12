import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import { BonusesService } from "./bonuses.service.js";
import {
  CreateBonusDto,
  DecideBonusDto,
  QueryBonusDto,
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
