import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  RequireAnyPermission,
  RequirePermission,
} from "../../common/decorators/require-permission.decorator.js";
import { MY_WORK_PERMISSIONS } from "./my-work.permissions.js";
import { PROJECT_TASK_WRITE_PERMISSIONS } from "./project-task-write.permissions.js";
import { CreateTaskDto, UpdateTaskDto } from "./dto/create-task.dto.js";
import { TasksService } from "./tasks.service.js";

@ApiTags("Project Tasks")
@ApiBearerAuth()
@Controller("projects")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get(":id/tasks")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "List tasks for a project" })
  findTasks(@Param("id", ParseIntPipe) projectId: number) {
    return this.service.findTasks(projectId);
  }

  // Own-data endpoint: gated like the My Work menu item and the stopwatch
  // (employee_self_service.work.write or projects.timer.write), so employees
  // need no org-wide project read.
  @Get("tasks/my-work")
  @RequireAnyPermission(...MY_WORK_PERMISSIONS)
  @ApiOperation({ summary: "List tasks assigned to the current employee" })
  findMyWork() {
    return this.service.findMyWork();
  }

  // Own-data endpoint, gated like My Work: the employee's points awards and
  // how each was calculated.
  @Get("points/my")
  @RequireAnyPermission(...MY_WORK_PERMISSIONS)
  @ApiOperation({
    summary: "The current employee's points awards with their breakdown",
  })
  findMyPoints() {
    return this.service.findMyPoints();
  }

  @Get("tasks/:taskId")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "Get task detail by ID" })
  findTaskById(@Param("taskId", ParseIntPipe) taskId: number) {
    return this.service.findTaskById(taskId);
  }

  @Post(":id/tasks")
  @RequireAnyPermission(...PROJECT_TASK_WRITE_PERMISSIONS)
  @ApiOperation({
    summary: "Create task under a project with auto-generated TSK-XXXXXX code",
  })
  createTask(
    @Param("id", ParseIntPipe) projectId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.createTask(projectId, dto);
  }

  @Patch("tasks/:taskId")
  @RequireAnyPermission(...PROJECT_TASK_WRITE_PERMISSIONS)
  @ApiOperation({
    summary: "Update task status, completion percent, or priority",
  })
  updateTask(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.updateTask(taskId, dto);
  }

  @Delete("tasks/:taskId")
  @RequireAnyPermission(...PROJECT_TASK_WRITE_PERMISSIONS)
  @ApiOperation({ summary: "Soft delete a task" })
  deleteTask(@Param("taskId", ParseIntPipe) taskId: number) {
    return this.service.softDeleteTask(taskId);
  }
}
