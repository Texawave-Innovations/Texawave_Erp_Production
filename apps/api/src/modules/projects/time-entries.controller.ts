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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto.js";
import { TimeEntriesService } from "./time-entries.service.js";

@ApiTags("Project Time Entries & Stopwatch")
@ApiBearerAuth()
@Controller("projects/tasks")
export class TimeEntriesController {
  constructor(private readonly service: TimeEntriesService) {}

  @Get("timer/active")
  @RequirePermission("projects.timer.write")
  @ApiOperation({
    summary: "Get currently running timer for the authenticated employee",
  })
  getActiveTimer() {
    return this.service.getActiveTimer();
  }

  @Post(":taskId/timer/start")
  @RequirePermission("projects.timer.write")
  @ApiOperation({ summary: "Start live stopwatch timer for a task" })
  startTimer(@Param("taskId", ParseIntPipe) taskId: number) {
    return this.service.startTimer(taskId);
  }

  @Post(":taskId/timer/stop")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("projects.timer.write")
  @ApiOperation({
    summary: "Stop live stopwatch timer and compute logged hours",
  })
  stopTimer(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Body("notes") notes?: string,
  ) {
    return this.service.stopTimer(taskId, notes);
  }

  @Post(":taskId/time-entries")
  @RequirePermission("projects.timer.write")
  @ApiOperation({ summary: "Log manual work duration in minutes for a task" })
  createManualTimeEntry(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.service.createManualTimeEntry(taskId, dto);
  }

  @Get(":taskId/time-entries")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "List time entries for a task" })
  getTaskTimeEntries(@Param("taskId", ParseIntPipe) taskId: number) {
    return this.service.findTaskTimeEntries(taskId);
  }
}
