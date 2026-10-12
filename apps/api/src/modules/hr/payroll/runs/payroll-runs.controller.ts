import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  ApprovePayrollRunDto,
  CreatePayrollRunDto,
  QueryPayrollEntryDto,
  QueryPayrollRunDto,
} from "./dto/payroll-run.dto.js";
import { PayrollRunsService } from "./payroll-runs.service.js";

@ApiTags("hr-payroll-runs")
@Controller("hr/payroll")
export class PayrollRunsController {
  constructor(private readonly service: PayrollRunsService) {}

  @Post("runs")
  @RequireScopedPermission("hr.payroll.write")
  @ApiOperation({ summary: "Execute a payroll run for a period" })
  createRun(@Body() dto: CreatePayrollRunDto) {
    return this.service.createRun(dto);
  }

  @Get("runs")
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({ summary: "List payroll runs with pagination" })
  findAllRuns(@Paginate(QueryPayrollRunDto) query: QueryPayrollRunDto) {
    return this.service.findAllRuns(query);
  }

  @Get("runs/:id")
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({ summary: "Get payroll run by id" })
  findRunById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findRunById(id);
  }

  @Post("runs/:id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.payroll.approve")
  @ApiOperation({ summary: "Approve a processed payroll run" })
  approveRun(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApprovePayrollRunDto,
  ) {
    return this.service.approveRun(id, dto);
  }

  @Get("entries")
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({
    summary: "List employee payroll entries with filtering and pagination",
  })
  findAllEntries(@Paginate(QueryPayrollEntryDto) query: QueryPayrollEntryDto) {
    return this.service.findAllEntries(query);
  }

  @Get("entries/:id")
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({
    summary: "Get employee payroll entry with earnings & deductions",
  })
  findEntryById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findEntryById(id);
  }
}
