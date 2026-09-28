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
import { CreateDepartmentDto } from "./dto/create-department.dto.js";
import { QueryDepartmentDto } from "./dto/query-department.dto.js";
import { UpdateDepartmentDto } from "./dto/update-department.dto.js";
import { DepartmentsService } from "./departments.service.js";

@ApiTags("departments")
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermission("departments.department.read")
  @ApiOperation({ summary: "List departments for the current organization" })
  findAll(@Paginate(QueryDepartmentDto) pagination: QueryDepartmentDto) {
    return this.departments.findAll(pagination);
  }

  @Get(":id")
  @RequirePermission("departments.department.read")
  @ApiOperation({ summary: "Get department detail by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.departments.findOne(id);
  }

  @Post()
  @RequirePermission("departments.department.write")
  @ApiOperation({ summary: "Create a new department" })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(":id")
  @RequirePermission("departments.department.write")
  @ApiOperation({ summary: "Update an existing department" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("departments.department.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a department" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.departments.remove(id);
  }
}
