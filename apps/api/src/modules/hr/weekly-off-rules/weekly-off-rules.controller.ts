import {
  Body,
  Controller,
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
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateWeeklyOffRuleDto,
  EndWeeklyOffRuleDto,
  QueryWeeklyOffRuleDto,
  UpdateWeeklyOffRuleDto,
  VoidWeeklyOffRuleDto,
} from "./dto/weekly-off-rule.dto.js";
import { WeeklyOffRulesService } from "./weekly-off-rules.service.js";

/** No day is assumed to be a weekly off: a rule exists only if it is created.
 * Rules are never edited in place or deleted — end the old, create the new;
 * void a mistake. */
@ApiTags("hr-weekly-off-rules")
@Controller("hr/weekly-off-rules")
export class WeeklyOffRulesController {
  constructor(private readonly rules: WeeklyOffRulesService) {}

  @Get()
  @RequirePermission("hr.weekly_off.read")
  findAll(@Paginate(QueryWeeklyOffRuleDto) query: QueryWeeklyOffRuleDto) {
    return this.rules.findAll(query);
  }

  @Get(":id")
  @RequirePermission("hr.weekly_off.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rules.findOne(id);
  }

  @Post()
  @RequirePermission("hr.weekly_off.write")
  @ApiOperation({
    summary: "Define which weekdays are off, for whom, and from when",
  })
  create(@Body() dto: CreateWeeklyOffRuleDto) {
    return this.rules.create(dto);
  }

  @Patch(":id")
  @RequirePermission("hr.weekly_off.write")
  @ApiOperation({
    summary: "Rename/describe only — days and dates are history",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWeeklyOffRuleDto,
  ) {
    return this.rules.update(id, dto);
  }

  @Post(":id/end")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.weekly_off.write")
  end(@Param("id", ParseIntPipe) id: number, @Body() dto: EndWeeklyOffRuleDto) {
    return this.rules.end(id, dto);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.weekly_off.write")
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidWeeklyOffRuleDto,
  ) {
    return this.rules.void(id, dto);
  }
}
