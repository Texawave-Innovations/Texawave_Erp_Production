import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  ApproveLeaveRequestDto,
  HrLeaveBalanceQueryDto,
  QueryLeaveRequestDto,
  RejectLeaveRequestDto,
  SetLeaveEntitlementDto,
} from "./dto/leave-request.dto.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

/** HR/approver surface. Reads are own/team/all; deciding needs the separate
 * `hr.leave.approve` permission and can never be applied to one's own request.
 * Requests are final once decided; a PENDING request may be decided only once.
 * Withdrawal and resubmission are the employee's own actions (self-service). */
@ApiTags("hr-leave-requests")
@Controller("hr/leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leave: LeaveRequestsService) {}

  @Get()
  @RequireScopedPermission("hr.leave_request.read")
  @ApiOperation({
    summary:
      "Leave requests in the caller's scope; also the leave history of an employee",
  })
  findAll(@Paginate(QueryLeaveRequestDto) query: QueryLeaveRequestDto) {
    return this.leave.findAll(query);
  }

  @Get("balances")
  @RequireScopedPermission("hr.leave_request.read")
  @ApiOperation({
    summary:
      "An employee's leave balances for a year (within the caller's scope)",
  })
  balances(@Query() query: HrLeaveBalanceQueryDto) {
    return this.leave.hrBalances(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.leave_request.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leave.findOne(id);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.leave.approve")
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveLeaveRequestDto,
  ) {
    return this.leave.approve(id, dto);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.leave.approve")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leave.reject(id, dto);
  }
}

/** Per-employee entitlement overrides. Organization-wide administration, so it
 * is gated by `hr.leave_type.write` (no separate balance permission is added). */
@ApiTags("hr-leave-requests")
@Controller("hr/leave-entitlements")
export class LeaveEntitlementsController {
  constructor(private readonly leave: LeaveRequestsService) {}

  @Put(":employeeId/:leaveTypeId/:year")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.leave_type.write")
  @ApiOperation({
    summary:
      "Set or clear (null) one employee's annual entitlement for a leave type and year",
  })
  set(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("leaveTypeId", ParseIntPipe) leaveTypeId: number,
    @Param("year", ParseIntPipe) year: number,
    @Body() dto: SetLeaveEntitlementDto,
  ) {
    return this.leave.setEntitlement(employeeId, leaveTypeId, year, dto);
  }
}
