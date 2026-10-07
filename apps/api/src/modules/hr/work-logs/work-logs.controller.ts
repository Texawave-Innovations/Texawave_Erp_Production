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
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  DecideWorkLogDto,
  QueryWorkLogApprovalsDto,
  QueryWorkLogDto,
} from "./dto/work-log.dto.js";
import { WorkLogsService } from "./work-logs.service.js";

/** HR/approver surface. Reads are own/team/all; deciding needs
 * `hr.work_log.approve` and is limited to the caller's direct reports. Logs
 * are final once decided — there is no edit or delete (none in legacy). */
@ApiTags("hr-work-logs")
@Controller("hr/work-logs")
export class WorkLogsController {
  constructor(private readonly workLogs: WorkLogsService) {}

  @Get()
  @RequireScopedPermission("hr.work_log.read")
  @ApiOperation({ summary: "Work logs in the caller's scope" })
  findAll(@Paginate(QueryWorkLogDto) query: QueryWorkLogDto) {
    return this.workLogs.findAll(query);
  }

  @Get("approvals")
  @RequirePermission("hr.work_log.approve")
  @ApiOperation({
    summary: "Work logs of my direct reports (defaults to PENDING)",
  })
  findApprovals(
    @Paginate(QueryWorkLogApprovalsDto) query: QueryWorkLogApprovalsDto,
  ) {
    return this.workLogs.findApprovals(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.work_log.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.workLogs.findOne(id);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.work_log.approve")
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DecideWorkLogDto,
  ) {
    return this.workLogs.approve(id, dto);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.work_log.approve")
  reject(@Param("id", ParseIntPipe) id: number, @Body() dto: DecideWorkLogDto) {
    return this.workLogs.reject(id, dto);
  }
}
