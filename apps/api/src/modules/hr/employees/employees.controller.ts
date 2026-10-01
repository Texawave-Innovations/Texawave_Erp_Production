import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import { QueryEmployeeDto } from "./dto/query-employee.dto.js";
import { UpdateEmployeeDto } from "./dto/update-employee.dto.js";
import { EmployeesService } from "./employees.service.js";

/** Team-scoped: `hr.employee.read/write` are seeded as `.own/.team/.all`.
 * The guard admits any holder; the service narrows the rows to the caller's
 * scope (own → themselves, team → their teams, all → everyone). There is no
 * DELETE — people leave through the status lifecycle and are never removed. */
@ApiTags("hr-employees")
@Controller("hr/employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary: "List employees in the caller's scope (no phone/e-mail)",
  })
  findAll(@Paginate(QueryEmployeeDto) query: QueryEmployeeDto) {
    return this.employees.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.employee.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.employees.findOne(id);
  }

  @Get(":id/status-history")
  @RequireScopedPermission("hr.employee.read")
  statusHistory(
    @Param("id", ParseIntPipe) id: number,
    @Paginate(PaginationDto) pagination: PaginationDto,
  ) {
    return this.employees.statusHistory(id, pagination);
  }

  @Post()
  @RequireScopedPermission("hr.employee.write")
  @ApiOperation({
    summary: "Create an employee; the EMP-nnnnnn code is generated",
  })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.employee.write")
  @ApiOperation({
    summary: "Update profile/employment details (requires the current version)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(id, dto);
  }
}
