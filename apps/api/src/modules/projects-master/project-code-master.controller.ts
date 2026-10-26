import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { UpdateProjectCodeMasterDto } from "./dto/update-project-code-master.dto.js";
import { ProjectCodeMasterService } from "./project-code-master.service.js";

/** Tab 2 of Projects Master Lists — the project-code format generator
 * (`[Prefix]/[Category]/[Project Code]/[Year]/[Sequence]`). One row per org. */
@ApiTags("projects-master-code-master")
@Controller("projects-master/code-master")
export class ProjectCodeMasterController {
  constructor(private readonly codeMaster: ProjectCodeMasterService) {}

  @Get()
  @RequirePermission("projects_master.project_code_master.read")
  @ApiOperation({ summary: "Get the organization's project code format" })
  findOne() {
    return this.codeMaster.findOne();
  }

  @Put()
  @RequirePermission("projects_master.project_code_master.write")
  @ApiOperation({ summary: "Create or replace the project code format" })
  upsert(@Body() dto: UpdateProjectCodeMasterDto) {
    return this.codeMaster.upsert(dto);
  }
}
