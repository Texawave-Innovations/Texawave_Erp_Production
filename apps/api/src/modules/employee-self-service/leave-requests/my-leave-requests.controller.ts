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
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeaveBalanceQueryDto,
  QueryMyLeaveRequestDto,
} from "../../hr/leave-requests/dto/leave-request.dto.js";
import { LeaveRequestsService } from "../../hr/leave-requests/leave-requests.service.js";

/** The authenticated user's OWN leave. There is no employee id in any request:
 * "who am I" is resolved from the JWT (employee↔user mapping), so it is
 * impossible to submit, read, cancel or resubmit anyone else's leave here.
 * Cancel and resubmit reuse the request permission: they are the employee's
 * own actions on their own request. */
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

  @Get("balances")
  @RequirePermission("employee_self_service.leave_request.read")
  @ApiOperation({
    summary:
      "My leave balances for a year, per active leave type (available is null for unpaid leave)",
  })
  myBalances(@Query() query: LeaveBalanceQueryDto) {
    return this.leave.myBalances(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.leave_request.read")
  @ApiOperation({ summary: "One of my leave requests (another id is 404)" })
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.leave.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.leave_request.create")
  @ApiOperation({
    summary:
      "Request leave for myself (starts PENDING; working days only; balance enforced for paid leave)",
  })
  create(@Body() dto: CreateLeaveRequestDto) {
    return this.leave.createForCurrentEmployee(dto);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("employee_self_service.leave_request.create")
  @ApiOperation({
    summary: "Withdraw my PENDING request, or my APPROVED one before it starts",
  })
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelLeaveRequestDto,
  ) {
    return this.leave.cancelMine(id, dto);
  }

  @Post(":id/resubmit")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("employee_self_service.leave_request.create")
  @ApiOperation({
    summary:
      "Resubmit my REJECTED or CANCELLED request (re-validated; back to PENDING)",
  })
  resubmit(@Param("id", ParseIntPipe) id: number) {
    return this.leave.resubmitMine(id);
  }
}
