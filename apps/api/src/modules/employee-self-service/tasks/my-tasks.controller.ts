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
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateMyTaskDto,
  QueryMyTaskDto,
  UpdateMyTaskStatusDto,
} from "../../hr/tasks/dto/task.dto.js";
import { TasksService } from "../../hr/tasks/tasks.service.js";

/** The authenticated user's OWN tasks: assigned to them or created by them.
 * No employee id in any request — resolved from the JWT. */
@ApiTags("employee-self-service")
@Controller("self-service/tasks")
export class MyTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission("employee_self_service.task.read")
  @ApiOperation({ summary: "My tasks (assigned to me or created by me)" })
  findMine(@Paginate(QueryMyTaskDto) query: QueryMyTaskDto) {
    return this.tasks.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.task.read")
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.task.create")
  @ApiOperation({
    summary: "Create a task for myself (optionally request admin attention)",
  })
  create(@Body() dto: CreateMyTaskDto) {
    return this.tasks.createForCurrentEmployee(dto);
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("employee_self_service.task.update_status")
  @ApiOperation({
    summary:
      "Start, complete or reopen my task (locked once admin approves it)",
  })
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMyTaskStatusDto,
  ) {
    return this.tasks.updateMyStatus(id, dto);
  }
}
