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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  ApproveLeaveRequestDto,
  BulkSetLeaveEntitlementsDto,
  CreateLeaveDelegationDto,
  DelegationCandidateQueryDto,
  ExportLeaveRequestQueryDto,
  HrCancelLeaveRequestDto,
  HrCreateLeaveRequestDto,
  HrLeaveBalanceQueryDto,
  ImportLeaveEntitlementsQueryDto,
  LeaveBalanceReportQueryDto,
  QueryAwaitingLeaveDto,
  QueryLeaveDelegationDto,
  QueryLeaveRequestDto,
  RejectLeaveRequestDto,
  SetLeaveEntitlementDto,
} from "./dto/leave-request.dto.js";
import { MAX_IMPORT_BYTES } from "./leave-csv.js";
import { LeaveDelegationsService } from "./leave-delegations.service.js";
import { LeaveRequestsService } from "./leave-requests.service.js";
import { LeaveTransferService } from "./leave-transfer.service.js";

/** HR/approver surface (Docs/HR_LEAVE.md §6). Reads are own/team/all.
 * Deciding needs `hr.leave.approve`: any level decides for the caller's
 * direct reports (and delegations), `.team`/`.all` within scope, and only
 * `.all` gives the second (HR) approval; nobody decides their own request or
 * one they submitted. Applying on someone's behalf (`hr.leave_request.create`)
 * and cancelling someone's leave (`hr.leave.cancel`) are team-scoped; `.own`
 * of both grants nothing. Literal routes come before `:id`. */
@ApiTags("hr-leave-requests")
@Controller("hr/leave-requests")
export class LeaveRequestsController {
  constructor(
    private readonly leave: LeaveRequestsService,
    private readonly transfer: LeaveTransferService,
  ) {}

  @Get()
  @RequireScopedPermission("hr.leave_request.read")
  @ApiOperation({
    summary:
      "Leave requests in the caller's scope; also the leave history of an employee",
  })
  findAll(@Paginate(QueryLeaveRequestDto) query: QueryLeaveRequestDto) {
    return this.leave.findAll(query);
  }

  @Post()
  @RequireScopedPermission("hr.leave_request.create")
  @ApiOperation({
    summary:
      "Apply for leave on an employee's behalf (within scope; never yourself). Same rules as self-service; it then waits for approval",
  })
  createOnBehalf(@Body() dto: HrCreateLeaveRequestDto) {
    return this.leave.createOnBehalf(dto);
  }

  @Get("approvals")
  @RequireScopedPermission("hr.leave.approve")
  @ApiOperation({
    summary:
      "PENDING requests waiting for YOUR decision: your direct reports (and delegations), your approve scope, and — for .all — HR's second approval",
  })
  findAwaiting(@Paginate(QueryAwaitingLeaveDto) query: QueryAwaitingLeaveDto) {
    return this.leave.findAwaiting(query);
  }

  @Get("export")
  @RequireScopedPermission("hr.leave_request.export")
  @RawResponse()
  @ApiOperation({
    summary:
      "CSV of the leave requests in the caller's export scope (same filters as the list; at most 50,000 rows)",
  })
  async exportRequests(@Query() query: ExportLeaveRequestQueryDto) {
    const csv = await this.transfer.exportRequests(query);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="leave-requests.csv"`,
    });
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

  @Get("balances/report")
  @RequireScopedPermission("hr.leave_request.read")
  @ApiOperation({
    summary:
      "Balances of every active leave type for a page of employees in scope (allotment view: default vs custom entitlement)",
  })
  balanceReport(
    @Paginate(LeaveBalanceReportQueryDto) query: LeaveBalanceReportQueryDto,
  ) {
    return this.transfer.balanceReport(query);
  }

  @Get("balances/export")
  @RequireScopedPermission("hr.leave_request.export")
  @RawResponse()
  @ApiOperation({
    summary:
      "CSV of the balance report: one row per employee and leave type (at most 50,000 rows)",
  })
  async exportBalances(
    @Paginate(LeaveBalanceReportQueryDto) query: LeaveBalanceReportQueryDto,
  ) {
    const csv = await this.transfer.exportBalances(query);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="leave-balances-${query.year ?? "current"}.csv"`,
    });
  }

  @Get(":id")
  @RequireScopedPermission("hr.leave_request.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leave.findOne(id);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.leave.approve")
  @ApiOperation({
    summary:
      "Approve. On a two-level request the first approval keeps it PENDING for HR",
  })
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

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.leave.cancel")
  @ApiOperation({
    summary:
      "Cancel someone's PENDING or APPROVED leave (an approved one even after it started), with a reason. Refused for a closed attendance month",
  })
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: HrCancelLeaveRequestDto,
  ) {
    return this.leave.hrCancel(id, dto);
  }
}

/** Per-employee entitlement overrides. Organization-wide administration, so it
 * is gated by `hr.leave_type.write` (no separate balance permission is added). */
@ApiTags("hr-leave-requests")
@Controller("hr/leave-entitlements")
export class LeaveEntitlementsController {
  constructor(
    private readonly leave: LeaveRequestsService,
    private readonly transfer: LeaveTransferService,
  ) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.leave_type.write")
  @ApiOperation({
    summary:
      "Set or clear many entitlements at once (at most 500), all or none",
  })
  setMany(@Body() dto: BulkSetLeaveEntitlementsDto) {
    return this.transfer.setEntitlements(dto);
  }

  @Post("import")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.leave_type.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Entitlements from a CSV (field: file; Employee Code, Leave Type Code, Year, Annual Entitlement — blank removes the override; at most 5,000 rows). All rows or none; ?dryRun=true checks without saving",
  })
  importCsv(
    @Query() query: ImportLeaveEntitlementsQueryDto,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    return this.transfer.importEntitlements(file, query.dryRun ?? false);
  }

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

/** A leave approver's stand-ins (Docs/HR_LEAVE.md §6.2). The caller's own
 * delegations only; gated by any `hr.leave.approve` level. */
@ApiTags("hr-leave-requests")
@Controller("hr/leave-delegations")
export class LeaveDelegationsController {
  constructor(private readonly delegations: LeaveDelegationsService) {}

  @Get()
  @RequireScopedPermission("hr.leave.approve")
  @ApiOperation({ summary: "Delegations you gave or received" })
  findMine(@Paginate(QueryLeaveDelegationDto) query: QueryLeaveDelegationDto) {
    return this.delegations.findMine(query);
  }

  @Get("candidates")
  @RequireScopedPermission("hr.leave.approve")
  @ApiOperation({
    summary:
      "Users you may name as a delegate: other active users holding a leave approval permission (id and name only; ?search=; at most 50)",
  })
  candidates(@Query() query: DelegationCandidateQueryDto) {
    return this.delegations.candidates(query.search);
  }

  @Post()
  @RequireScopedPermission("hr.leave.approve")
  @ApiOperation({
    summary:
      "Let another approver decide your direct reports' leave for a date range (at most 90 days; one at a time)",
  })
  create(@Body() dto: CreateLeaveDelegationDto) {
    return this.delegations.create(dto);
  }

  @Post(":id/revoke")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.leave.approve")
  revoke(@Param("id", ParseIntPipe) id: number) {
    return this.delegations.revoke(id);
  }
}
