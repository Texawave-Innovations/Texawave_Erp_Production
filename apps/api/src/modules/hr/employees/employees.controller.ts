import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import {
  ImportEmployeesQueryDto,
  MAX_IMPORT_BYTES,
} from "./dto/import-employees.dto.js";
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

  // Fixed paths are declared before ":id" so they are not parsed as an id.

  @Get("stats")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({
    summary:
      "Directory counts in the caller's scope: by status, onboarding, team",
  })
  stats() {
    return this.employees.stats();
  }

  @Get("export")
  @RequireScopedPermission("hr.employee.export")
  @RawResponse()
  @ApiOperation({
    summary:
      "CSV of the employees in the caller's export scope (same filters as the list; at most 10,000 rows)",
  })
  async exportCsv(@Paginate(QueryEmployeeDto) query: QueryEmployeeDto) {
    const csv = await this.employees.exportCsv(query);
    const day = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="employees-${day}.csv"`,
    });
  }

  @Post("import")
  @RequireScopedPermission("hr.employee.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Create employees from a CSV (field: file; at most 500 rows). All rows or none; ?dryRun=true validates without saving",
  })
  importCsv(
    @Query() query: ImportEmployeesQueryDto,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    return this.employees.importCsv(file, query.dryRun ?? false);
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
