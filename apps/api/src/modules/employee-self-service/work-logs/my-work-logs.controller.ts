import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateWorkLogDto,
  QueryMyWorkLogDto,
} from "../../hr/work-logs/dto/work-log.dto.js";
import { WorkLogsService } from "../../hr/work-logs/work-logs.service.js";

/** The authenticated user's OWN work logs. No employee id in any request:
 * "who am I" is resolved from the JWT (employee↔user mapping). */
@ApiTags("employee-self-service")
@Controller("self-service/work-logs")
export class MyWorkLogsController {
  constructor(private readonly workLogs: WorkLogsService) {}

  @Get()
  @RequirePermission("employee_self_service.work_log.read")
  @ApiOperation({ summary: "My work logs" })
  findMine(@Paginate(QueryMyWorkLogDto) query: QueryMyWorkLogDto) {
    return this.workLogs.findMine(query);
  }

  @Post()
  @RequirePermission("employee_self_service.work_log.create")
  @ApiOperation({ summary: "Submit a work log for myself (starts PENDING)" })
  create(@Body() dto: CreateWorkLogDto) {
    return this.workLogs.createForCurrentEmployee(dto);
  }
}
