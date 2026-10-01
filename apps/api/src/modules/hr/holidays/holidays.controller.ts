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
  CreateHolidayDto,
  QueryHolidayDto,
  UpdateHolidayDto,
} from "./dto/holiday.dto.js";
import { HolidaysService } from "./holidays.service.js";

/** Organization-wide reference data (every employee may read it), so exact
 * permissions rather than team scopes. No DELETE: a wrong entry is
 * deactivated and re-entered, keeping history. */
@ApiTags("hr-holidays")
@Controller("hr/holidays")
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @RequirePermission("hr.holiday.read")
  @ApiOperation({
    summary: "List holidays (by year or date range, location, active state)",
  })
  findAll(@Paginate(QueryHolidayDto) query: QueryHolidayDto) {
    return this.holidays.findAll(query);
  }

  @Get(":id")
  @RequirePermission("hr.holiday.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.holidays.findOne(id);
  }

  @Post()
  @RequirePermission("hr.holiday.write")
  create(@Body() dto: CreateHolidayDto) {
    return this.holidays.create(dto);
  }

  @Patch(":id")
  @RequirePermission("hr.holiday.write")
  @ApiOperation({
    summary: "Rename/describe. The date and location scope are immutable.",
  })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateHolidayDto) {
    return this.holidays.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.holiday.write")
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.holidays.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.holiday.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.holidays.setActive(id, true);
  }
}
