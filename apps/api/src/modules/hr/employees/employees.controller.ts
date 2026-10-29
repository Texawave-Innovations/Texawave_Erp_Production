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
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { MAX_UPLOAD_BYTES } from "../../../shared/file-storage/file-storage.service.js";
import { AddressDto } from "../../employee-self-service/profile/dto/address.dto.js";
import { BankDetailsDto } from "../../employee-self-service/profile/dto/bank-details.dto.js";
import { GovernmentIdsDto } from "../../employee-self-service/profile/dto/government-ids.dto.js";
import { PersonalDetailsDto } from "../../employee-self-service/profile/dto/personal-details.dto.js";
import {
  ImportEmployeesQueryDto,
  MAX_IMPORT_BYTES,
} from "./dto/import-employees.dto.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import { QueryEmployeeDto } from "./dto/query-employee.dto.js";
import { UpdateEmployeeDto } from "./dto/update-employee.dto.js";
import { EmployeePersonalDataService } from "./employee-personal-data.service.js";
import { EmployeesService } from "./employees.service.js";

/** Team-scoped: `hr.employee.read/write` are seeded as `.own/.team/.all`.
 * The guard admits any holder; the service narrows the rows to the caller's
 * scope (own → themselves, team → their teams, all → everyone). Normally
 * people leave through the status lifecycle and are never removed; DELETE
 * exists as an organization-wide, separately-permissioned escape hatch for a
 * record that should never have existed, and only succeeds when nothing else
 * in the system still references it. */
@ApiTags("hr-employees")
@Controller("hr/employees")
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly personalData: EmployeePersonalDataService,
  ) {}

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

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("hr.employee.delete")
  @ApiOperation({
    summary:
      "Permanently delete an employee record. Only succeeds when nothing " +
      "else references it (attendance, payroll, tasks, etc.) — otherwise use " +
      "the status lifecycle to deactivate them instead.",
  })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.employees.remove(id);
  }

  // HR's edit of an employee's onboarding detail tables — the path
  // ProfileService.editableIdentity() points to once a profile is
  // PROFILE_LOCKED ("Ask HR to update it"), and what the onboarding
  // progress view's per-section Edit action calls.

  @Get(":id/personal-details")
  @RequireScopedPermission("hr.employee.read")
  getPersonalDetails(@Param("id", ParseIntPipe) id: number) {
    return this.personalData.getPersonal(id);
  }

  @Put(":id/personal-details")
  @RequireScopedPermission("hr.employee.write")
  putPersonalDetails(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PersonalDetailsDto,
  ) {
    return this.personalData.updatePersonal(id, dto);
  }

  @Get(":id/address/:type")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({ summary: "type is PERMANENT or PRESENT" })
  getAddress(
    @Param("id", ParseIntPipe) id: number,
    @Param("type") type: string,
  ) {
    return this.personalData.getAddress(id, type);
  }

  @Put(":id/address/:type")
  @RequireScopedPermission("hr.employee.write")
  putAddress(
    @Param("id", ParseIntPipe) id: number,
    @Param("type") type: string,
    @Body() dto: AddressDto,
  ) {
    return this.personalData.updateAddress(id, type, dto);
  }

  @Get(":id/bank-details")
  @RequireScopedPermission("hr.employee.read")
  @ApiOperation({ summary: "Masked account number only" })
  getBankDetails(@Param("id", ParseIntPipe) id: number) {
    return this.personalData.getBank(id);
  }

  @Put(":id/bank-details")
  @RequireScopedPermission("hr.employee.write")
  putBankDetails(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: BankDetailsDto,
  ) {
    return this.personalData.updateBank(id, dto);
  }

  @Get(":id/government-ids")
  @RequireScopedPermission("hr.employee.read")
  getGovernmentIds(@Param("id", ParseIntPipe) id: number) {
    return this.personalData.getGovernmentIds(id);
  }

  @Put(":id/government-ids")
  @RequireScopedPermission("hr.employee.write")
  putGovernmentIds(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: GovernmentIdsDto,
  ) {
    return this.personalData.updateGovernmentIds(id, dto);
  }

  @Put(":id/documents/:documentType/file")
  @RequireScopedPermission("hr.employee.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload (or replace) one onboarding document on the employee's behalf. Field name: file.",
  })
  uploadDocumentFor(
    @Param("id", ParseIntPipe) id: number,
    @Param("documentType") documentType: string,
    @UploadedFile()
    file: { buffer: Buffer; size: number; originalname: string } | undefined,
  ) {
    return this.personalData.uploadDocument(id, documentType, file);
  }
}
