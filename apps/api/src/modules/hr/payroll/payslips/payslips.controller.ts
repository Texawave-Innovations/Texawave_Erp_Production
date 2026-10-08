import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../../common/decorators/raw-response.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import { GeneratePayslipsDto, QueryPayslipDto } from "./dto/payslip.dto.js";
import { PayslipPdfService } from "./payslip-pdf.service.js";
import { PayslipsService } from "./payslips.service.js";

@ApiTags("hr-payslips")
@Controller("hr/payslips")
export class PayslipsController {
  constructor(
    private readonly service: PayslipsService,
    private readonly pdf: PayslipPdfService,
  ) {}

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

  @Get(":id/pdf")
  @RequireScopedPermission("hr.payslip.read")
  @RawResponse()
  @ApiOperation({ summary: "Download a payslip as PDF" })
  async downloadPdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.pdf.forHr(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.payroll.write")
  @ApiOperation({ summary: "Generate payslips for an approved payroll period" })
  generate(@Body() dto: GeneratePayslipsDto) {
    return this.service.generateForPeriod(dto.payrollPeriodId);
  }
}
