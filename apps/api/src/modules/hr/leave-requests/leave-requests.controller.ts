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
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  ApproveLeaveRequestDto,
  QueryLeaveRequestDto,
  RejectLeaveRequestDto,
} from "./dto/leave-request.dto.js";
import { LeaveRequestsService } from "./leave-requests.service.js";

/** HR/approver surface. Reads are own/team/all; deciding needs the separate
 * `hr.leave.approve` permission and can never be applied to one's own request.
 * Requests are immutable once submitted and final once decided — there is no
 * edit, cancel or delete (cancellation policy is not approved). */
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
