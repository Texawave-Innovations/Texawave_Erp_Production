import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../../../common/decorators/raw-response.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  PayrollReportsService,
  type ReportFile,
} from "./payroll-reports.service.js";

function file(f: ReportFile) {
  return new StreamableFile(Buffer.from(f.content, "utf8"), {
    type: f.contentType,
    disposition: `attachment; filename="${encodeURIComponent(f.fileName)}"`,
  });
}

/** Organization-wide payroll files for one period; `.all` export only
 * (checked in the service). */
@ApiTags("hr-payroll-reports")
@Controller("hr/payroll/periods/:periodId/reports")
export class PayrollReportsController {
  constructor(private readonly service: PayrollReportsService) {}

  @Get("pf-ecr")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "EPFO ECR v2 text file (finalized period)" })
  async pfEcr(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.pfEcr(id));
  }

  @Get("esi")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "ESIC monthly contribution upload (CSV)" })
  async esi(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.esiUpload(id));
  }

  @Get("professional-tax")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "Professional Tax deducted (CSV)" })
  async pt(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.professionalTax(id));
  }

  @Get("tds")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "TDS deducted with PAN (CSV, basis for 24Q)" })
  async tds(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.tds(id));
  }

  @Get("journal")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "Salary journal for Finance (CSV, balanced)" })
  async journal(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.journal(id));
  }

  @Get("salary-register")
  @RequireScopedPermission("hr.payroll.export")
  @RawResponse()
  @ApiOperation({ summary: "Salary register, one column per component (CSV)" })
  async register(@Param("periodId", ParseIntPipe) id: number) {
    return file(await this.service.salaryRegister(id));
  }
}
