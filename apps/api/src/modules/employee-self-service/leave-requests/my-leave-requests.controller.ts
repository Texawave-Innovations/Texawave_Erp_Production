import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateLeaveRequestDto,
  QueryMyLeaveRequestDto,
} from "../../hr/leave-requests/dto/leave-request.dto.js";
import { LeaveRequestsService } from "../../hr/leave-requests/leave-requests.service.js";

/** The authenticated user's OWN leave. There is no employee id in any request:
 * "who am I" is resolved from the JWT (employee↔user mapping), so it is
 * impossible to submit or list leave for anyone else here. */
@ApiTags("employee-self-service")
@Controller("self-service/leave-requests")
export class MyLeaveRequestsController {
  constructor(private readonly leave: LeaveRequestsService) {}

  @Get()
  @RequirePermission("employee_self_service.leave_request.read")
  @ApiOperation({ summary: "My leave requests (my leave history)" })
  findMine(@Paginate(QueryMyLeaveRequestDto) query: QueryMyLeaveRequestDto) {
    return this.leave.findMine(query);
  }

  @Post()
  @RequirePermission("employee_self_service.leave_request.create")
  @ApiOperation({
    summary: "Request leave for myself (starts PENDING; whole days only)",
  })
  create(@Body() dto: CreateLeaveRequestDto) {
    return this.leave.createForCurrentEmployee(dto);
  }
}
