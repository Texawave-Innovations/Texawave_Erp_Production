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
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../../common/decorators/require-permission.decorator.js";
import { GeneratePayslipsDto, QueryPayslipDto } from "./dto/payslip.dto.js";
import { PayslipsService } from "./payslips.service.js";

@ApiTags("hr-payslips")
@Controller("hr/payslips")
export class PayslipsController {
  constructor(private readonly service: PayslipsService) {}

  @Get()
  @RequireScopedPermission("hr.payslip.read")
  @ApiOperation({ summary: "List payslips within caller's scope" })
  findMany(@Paginate(QueryPayslipDto) query: QueryPayslipDto) {
    return this.service.findMany(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.payslip.read")
  @ApiOperation({ summary: "Get payslip details by ID" })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.payroll_run.write")
  @ApiOperation({ summary: "Generate payslips for an approved payroll period" })
  generate(@Body() dto: GeneratePayslipsDto) {
    return this.service.generateForPeriod(dto.payrollPeriodId);
  }
}
