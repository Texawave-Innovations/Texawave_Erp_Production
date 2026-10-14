import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../../common/decorators/require-permission.decorator.js";
import { QueryPayslipDto } from "./dto/payslip.dto.js";
import { PayslipPdfService } from "./payslip-pdf.service.js";
import { PayslipsService } from "./payslips.service.js";

@ApiTags("employee-self-service")
@Controller("self-service/payslips")
export class MyPayslipsController {
  constructor(
    private readonly service: PayslipsService,
    private readonly pdf: PayslipPdfService,
  ) {}

  @Get()
  @RequirePermission("employee_self_service.payslip.read")
  @ApiOperation({ summary: "List current authenticated employee's payslips" })
  findMine(@Paginate(QueryPayslipDto) query: QueryPayslipDto) {
    return this.service.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.payslip.read")
  @ApiOperation({
    summary: "Get current authenticated employee's payslip by ID",
  })
  findMineById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findMineById(id);
  }

  @Get(":id/pdf")
  @RequirePermission("employee_self_service.payslip.read")
  @RawResponse()
  @ApiOperation({ summary: "Download your own payslip as PDF" })
  async downloadMinePdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.pdf.forSelf(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }
}
