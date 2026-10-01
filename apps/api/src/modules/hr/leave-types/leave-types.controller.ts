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
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto.js";
import { QueryLeaveTypeDto } from "./dto/query-leave-type.dto.js";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto.js";
import { LeaveTypesService } from "./leave-types.service.js";

/** Kinds of leave (e.g. Casual, Sick). No types are seeded and no balance/accrual rules are attached — those are unapproved policy.
 * No DELETE route by design: rows are deactivated, never deleted, because
 * historical records keep referencing them. */
@ApiTags("hr-leave-types")
@Controller("hr/leave-types")
export class LeaveTypesController {
  constructor(private readonly leaveTypes: LeaveTypesService) {}

  @Get()
  @RequirePermission("hr.leave_type.read")
  @ApiOperation({ summary: "List leave types of the current organization" })
  findAll(@Paginate(QueryLeaveTypeDto) query: QueryLeaveTypeDto) {
    return this.leaveTypes.findAll(query);
  }

  @Get(":id")
  @RequirePermission("hr.leave_type.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leaveTypes.findOne(id);
  }

  @Post()
  @RequirePermission("hr.leave_type.write")
  create(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveTypes.create(dto);
  }

  @Patch(":id")
  @RequirePermission("hr.leave_type.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leaveTypes.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.leave_type.write")
  @ApiOperation({
    summary:
      "Deactivate — existing records keep it; new assignments are refused",
  })
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.leaveTypes.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.leave_type.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.leaveTypes.setActive(id, true);
  }
}
