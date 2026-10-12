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
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreatePayrollPeriodDto,
  QueryPayrollPeriodDto,
  UpdatePayrollPeriodDto,
} from "./dto/payroll-period.dto.js";
import { PayrollPeriodsService } from "./payroll-periods.service.js";

@ApiTags("hr-payroll-periods")
@Controller("hr/payroll/periods")
export class PayrollPeriodsController {
  constructor(private readonly service: PayrollPeriodsService) {}

  @Post()
  @RequireScopedPermission("hr.payroll.write")
  @ApiOperation({ summary: "Create a new monthly payroll period" })
  create(@Body() dto: CreatePayrollPeriodDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({
    summary: "List payroll periods with filtering and pagination",
  })
  findAll(@Paginate(QueryPayrollPeriodDto) query: QueryPayrollPeriodDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.payroll.read")
  @ApiOperation({ summary: "Get payroll period by id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.payroll.write")
  @ApiOperation({ summary: "Update payroll period status" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollPeriodDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/finalize")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.payroll.finalize")
  @ApiOperation({
    summary:
      "Finalize payroll period, lock calculations, and generate payslips",
  })
  finalize(@Param("id", ParseIntPipe) id: number) {
    return this.service.finalize(id);
  }
}
