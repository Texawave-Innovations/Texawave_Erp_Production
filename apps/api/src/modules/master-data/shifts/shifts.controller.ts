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
import { CreateShiftDto } from "./dto/create-shift.dto.js";
import { QueryShiftDto } from "./dto/query-shift.dto.js";
import { UpdateShiftDto } from "./dto/update-shift.dto.js";
import { ShiftsService } from "./shifts.service.js";

/** Shift templates: start/end time, working duration, overnight (derived). Break/grace/half-day policy is intentionally absent until approved.
 * No DELETE route by design: rows are deactivated, never deleted, because
 * historical records keep referencing them. */
@ApiTags("master-data-shifts")
@Controller("master-data/shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @RequirePermission("master.shift.read")
  @ApiOperation({ summary: "List shifts of the current organization" })
  findAll(@Paginate(QueryShiftDto) query: QueryShiftDto) {
    return this.shifts.findAll(query);
  }

  @Get(":id")
  @RequirePermission("master.shift.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.shifts.findOne(id);
  }

  @Post()
  @RequirePermission("master.shift.write")
  create(@Body() dto: CreateShiftDto) {
    return this.shifts.create(dto);
  }

  @Patch(":id")
  @RequirePermission("master.shift.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateShiftDto) {
    return this.shifts.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.shift.write")
  @ApiOperation({
    summary:
      "Deactivate — existing records keep it; new assignments are refused",
  })
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.shifts.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.shift.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.shifts.setActive(id, true);
  }
}
