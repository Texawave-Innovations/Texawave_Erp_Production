import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CreateProjectsMasterDto } from "./dto/create-projects-master.dto.js";
import { QueryProjectsMasterDto } from "./dto/query-projects-master.dto.js";
import { UpdateProjectsMasterDto } from "./dto/update-projects-master.dto.js";
import { ProjectsMasterService } from "./projects-master.service.js";

/** Projects Master — the registry of projects (code, name, department,
 * manager, status, dates). Budget/tasks/milestones are out of scope here. */
@ApiTags("projects-master")
@Controller("projects-master/projects")
export class ProjectsMasterController {
  constructor(private readonly projectsMaster: ProjectsMasterService) {}

  @Get()
  @RequirePermission("projects_master.project.read")
  @ApiOperation({ summary: "List projects for the current organization" })
  findAll(
    @Paginate(QueryProjectsMasterDto) pagination: QueryProjectsMasterDto,
  ) {
    return this.projectsMaster.findAll(pagination);
  }

  @Get(":id")
  @RequirePermission("projects_master.project.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.projectsMaster.findOne(id);
  }

  @Post()
  @RequirePermission("projects_master.project.write")
  create(@Body() dto: CreateProjectsMasterDto) {
    return this.projectsMaster.create(dto);
  }

  @Patch(":id")
  @RequirePermission("projects_master.project.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProjectsMasterDto,
  ) {
    return this.projectsMaster.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("projects_master.project.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.projectsMaster.remove(id);
  }
}
