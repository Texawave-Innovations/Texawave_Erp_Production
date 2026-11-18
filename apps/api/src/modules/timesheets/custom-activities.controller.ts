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
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CustomActivitiesService } from "./custom-activities.service.js";
import {
  CreateCustomActivityDto,
  UpdateCustomActivityDto,
} from "./dto/custom-activity.dto.js";

/**
 * Custom activities: work that is not an assigned task (meetings, discussions,
 * research...). The employee is always the signed-in user. They are timesheet
 * activities only — they never create or change a project task.
 */
@ApiTags("Timesheets")
@ApiBearerAuth()
@Controller("timesheets")
export class CustomActivitiesController {
  constructor(private readonly service: CustomActivitiesService) {}

  @Get("activity-categories")
  @RequirePermission("employee_self_service.timesheet.read")
  @ApiOperation({ summary: "Custom-activity categories for the form" })
  categories() {
    return this.service.categories();
  }

  @Get("linkable-projects")
  @RequirePermission("employee_self_service.timesheet.read")
  @ApiOperation({
    summary:
      "Projects I may link an activity to (member of, or hold a task in)",
  })
  linkableProjects() {
    return this.service.linkableProjects();
  }

  @Post("custom-activities")
  @RequirePermission("employee_self_service.timesheet.write")
  @ApiOperation({
    summary:
      "Record a custom activity (IST times on a work date; the server calculates the duration)",
  })
  create(@Body() dto: CreateCustomActivityDto) {
    return this.service.create(dto);
  }

  @Patch("custom-activities/:id")
  @RequirePermission("employee_self_service.timesheet.write")
  @ApiOperation({
    summary: "Edit my own custom activity while it is still a draft",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomActivityDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete("custom-activities/:id")
  @RequirePermission("employee_self_service.timesheet.write")
  @ApiOperation({
    summary: "Delete my own custom activity while it is a draft",
  })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
