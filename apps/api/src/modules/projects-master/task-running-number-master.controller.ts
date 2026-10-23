import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { UpdateTaskRunningNumberMasterDto } from "./dto/update-task-running-number-master.dto.js";
import { TaskRunningNumberMasterService } from "./task-running-number-master.service.js";

/** Tab 3 of Projects Master Lists — the task running-number format
 * generator (`[Project Code] [Separator] [Task Tag] [Sequence]`). One row
 * per org. */
@ApiTags("projects-master-task-running-number-master")
@Controller("projects-master/task-running-number-master")
export class TaskRunningNumberMasterController {
  constructor(private readonly taskNumbering: TaskRunningNumberMasterService) {}

  @Get()
  @RequirePermission("projects_master.task_running_number_master.read")
  @ApiOperation({ summary: "Get the organization's task numbering format" })
  findOne() {
    return this.taskNumbering.findOne();
  }

  @Put()
  @RequirePermission("projects_master.task_running_number_master.write")
  @ApiOperation({ summary: "Create or replace the task numbering format" })
  upsert(@Body() dto: UpdateTaskRunningNumberMasterDto) {
    return this.taskNumbering.upsert(dto);
  }
}
