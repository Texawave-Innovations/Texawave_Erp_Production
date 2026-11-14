import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateWorkPermissionDto,
  QueryMyWorkPermissionsDto,
} from "./dto/work-permission.dto.js";
import { MyWorkPermissionsService } from "./my-work-permissions.service.js";

/** The authenticated employee's own permission requests. No employee id in any
 * request — "who am I" is resolved from the JWT (employee↔user mapping). */
@ApiTags("employee-self-service")
@Controller("self-service/work-permissions")
export class MyWorkPermissionsController {
  constructor(private readonly service: MyWorkPermissionsService) {}

  @Get()
  @RequirePermission("employee_self_service.work_permission.read")
  @ApiOperation({ summary: "My work permission requests" })
  findMine(
    @Paginate(QueryMyWorkPermissionsDto) query: QueryMyWorkPermissionsDto,
  ) {
    return this.service.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.work_permission.read")
  @ApiOperation({ summary: "One of my work permission requests" })
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.work_permission.create")
  @ApiOperation({
    summary:
      "Submit a short-time permission request for myself (max 2 hours within 10:00–19:00)",
  })
  create(@Body() dto: CreateWorkPermissionDto) {
    return this.service.create(dto);
  }
}
