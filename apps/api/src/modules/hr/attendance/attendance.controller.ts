import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  RequirePermission,
  RequireScopedPermission,
} from "../../../common/decorators/require-permission.decorator.js";
import {
  ImportAttendanceQueryDto,
  ManualAttendanceEditDto,
  QueryAttendanceDto,
  QueryMyAttendanceDto,
} from "./dto/attendance.dto.js";
import { RangeAttendanceReportQueryDto } from "./dto/attendance-report.dto.js";
import { AttendanceService } from "./attendance.service.js";
import { MAX_IMPORT_BYTES } from "./import-export/attendance-csv.js";
import { AttendanceImportExportService } from "./import-export/attendance-import-export.service.js";

/** Check-in/out and "my attendance" are self-service: the employee is resolved
 * from the JWT and the client never names one. The HR view is own/team/all
 * scoped. Manual edit needs the write permission and is never allowed on
 * one's own record. */
@ApiTags("hr-attendance")
@Controller("hr/attendance")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly transfer: AttendanceImportExportService,
  ) {}

  @Post("check-in")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("employee_self_service.attendance.punch")
  @ApiOperation({
    summary: "Check in for the current user. The server sets the time.",
  })
  checkIn() {
    return this.attendance.checkIn();
  }

  @Post("check-out")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("employee_self_service.attendance.punch")
  @ApiOperation({
    summary: "Close the current user's open session. The server sets the time.",
  })
  checkOut() {
    return this.attendance.checkOut();
  }

  // Declared before `:id` so the literal path is not read as an id.
  @Get("mine")
  @RequirePermission("employee_self_service.attendance.read")
  @ApiOperation({ summary: "The current user's attendance in a date range" })
  findMine(@Paginate(QueryMyAttendanceDto) query: QueryMyAttendanceDto) {
    return this.attendance.findMine(query);
  }

  @Get("export")
  @RequireScopedPermission("hr.attendance.export")
  @RawResponse()
  @ApiOperation({
    summary:
      "CSV of every employee in the caller's export scope for each day in the range (unmarked days included; at most 62 days and 50,000 rows)",
  })
  async exportCsv(
    @Paginate(RangeAttendanceReportQueryDto)
    query: RangeAttendanceReportQueryDto,
  ) {
    const csv = await this.transfer.exportCsv(query);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="attendance-${query.from}-to-${query.to}.csv"`,
    });
  }

  @Post("import")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.attendance.import")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Add punch pairs from a CSV / biometric export (field: file; Employee Code, Date, Check In, Check Out; at most 5,000 rows). All rows or none; ?dryRun=true checks without saving",
  })
  importCsv(
    @Query() query: ImportAttendanceQueryDto,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    return this.transfer.importCsv(file, query.dryRun ?? false);
  }

  @Get()
  @RequireScopedPermission("hr.attendance.read")
  @ApiOperation({ summary: "Attendance records in the caller's scope" })
  findAll(@Paginate(QueryAttendanceDto) query: QueryAttendanceDto) {
    return this.attendance.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.attendance.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.attendance.findOne(id);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.attendance.write")
  @ApiOperation({
    summary: "HR manual edit of a day's status and punches (audited)",
  })
  manualEdit(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ManualAttendanceEditDto,
  ) {
    return this.attendance.manualEdit(id, dto);
  }
}
