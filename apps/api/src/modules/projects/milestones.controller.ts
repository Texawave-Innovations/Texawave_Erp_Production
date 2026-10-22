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
import { CreateMilestoneDto } from "./dto/create-milestone.dto.js";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto.js";
import { MilestonesService } from "./milestones.service.js";

@ApiTags("Project Milestones")
@ApiBearerAuth()
@Controller("projects")
export class MilestonesController {
  constructor(private readonly service: MilestonesService) {}

  @Get(":id/milestones")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "List milestones for a project" })
  findMilestones(@Param("id", ParseIntPipe) projectId: number) {
    return this.service.findMilestones(projectId);
  }

  @Post(":id/milestones")
  @RequirePermission("projects.task.write")
  @ApiOperation({ summary: "Create milestone for a project" })
  createMilestone(
    @Param("id", ParseIntPipe) projectId: number,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.service.createMilestone(projectId, dto);
  }

  @Patch("milestones/:milestoneId")
  @RequirePermission("projects.task.write")
  @ApiOperation({ summary: "Update milestone status or target date" })
  updateMilestone(
    @Param("milestoneId", ParseIntPipe) milestoneId: number,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.service.updateMilestone(milestoneId, dto);
  }

  @Delete("milestones/:milestoneId")
  @RequirePermission("projects.task.write")
  @ApiOperation({ summary: "Delete a milestone" })
  deleteMilestone(@Param("milestoneId", ParseIntPipe) milestoneId: number) {
    return this.service.deleteMilestone(milestoneId);
  }
}
