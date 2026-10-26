import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { AddProjectMemberDto } from "./dto/add-project-member.dto.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import { QueryProjectDto } from "./dto/query-project.dto.js";
import { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsService } from "./projects.service.js";

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermission("projects.project.read")
  @ApiOperation({
    summary: "List projects with pagination, filters, and health indicators",
  })
  findAll(@Query() query: QueryProjectDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  @RequirePermission("projects.project.read")
  @ApiOperation({ summary: "Get detailed project breakdown by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission("projects.project.write")
  @ApiOperation({
    summary: "Create new project with auto-generated sequential code",
  })
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects.project.write")
  @ApiOperation({ summary: "Update project metadata, dates, or status" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("projects.project.delete")
  @ApiOperation({ summary: "Soft delete a project" })
  softDelete(@Param("id", ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }

  @Post(":id/members")
  @RequirePermission("projects.project.write")
  @ApiOperation({ summary: "Assign employee member to project" })
  addMember(
    @Param("id", ParseIntPipe) projectId: number,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.service.addMember(projectId, dto);
  }

  @Delete(":id/members/:employeeId")
  @RequirePermission("projects.project.write")
  @ApiOperation({ summary: "Remove employee member from project" })
  removeMember(
    @Param("id", ParseIntPipe) projectId: number,
    @Param("employeeId", ParseIntPipe) employeeId: number,
  ) {
    return this.service.removeMember(projectId, employeeId);
  }

  @Get(":id/budget-utilization")
  @RequirePermission("projects.expenses.read")
  @ApiOperation({
    summary: "Get project budget utilization, EVM revenue earned, and variance",
  })
  getBudgetUtilization(@Param("id", ParseIntPipe) id: number) {
    return this.service.getBudgetUtilization(id);
  }
}
