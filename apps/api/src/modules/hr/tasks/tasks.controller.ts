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
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateTaskDto,
  QueryTaskDto,
  ReassignTaskDto,
  UpdateTaskStatusDto,
} from "./dto/task.dto.js";
import { TasksService } from "./tasks.service.js";

/** HR / admin task assignment. Reads and writes are team-scoped by the
 * ASSIGNEE's team (`hr.task.read/write` are seeded `.own/.team/.all`). Tasks
 * are never deleted (none in legacy); a task is closed by cancelling it. */
@ApiTags("hr-tasks")
@Controller("hr/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequireScopedPermission("hr.task.read")
  @ApiOperation({ summary: "Tasks in the caller's scope" })
  findAll(@Paginate(QueryTaskDto) query: QueryTaskDto) {
    return this.tasks.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.task.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.findOne(id);
  }

  @Post()
  @RequireScopedPermission("hr.task.write")
  @ApiOperation({ summary: "Assign a new task to an employee in scope" })
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.task.write")
  @ApiOperation({
    summary: "Reassign an open, admin-assigned task to another employee",
  })
  reassign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReassignTaskDto,
  ) {
    return this.tasks.reassign(id, dto);
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.task.write")
  @ApiOperation({
    summary:
      "Set status (PENDING, IN_PROGRESS, CANCELLED, or DONE to send for approval)",
  })
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasks.setStatus(id, dto);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.task.write")
  @ApiOperation({ summary: "Approve a completed task" })
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.approve(id);
  }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.task.write")
  @ApiOperation({
    summary: "Reopen a completed, unapproved task (back to IN_PROGRESS)",
  })
  reopen(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.reopen(id);
  }
}
