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
  Put,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../../common/decorators/raw-response.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreatePtSlabDto,
  QueryPtSlabDto,
  QueryTaxDeclarationDto,
  QueryTaxRegimeDto,
  SaveTaxDeclarationDto,
  SetPtLocationStateDto,
  UpdatePtSlabDto,
  UpsertTaxRegimeDto,
  VerifyTaxDeclarationDto,
} from "./dto/tax.dto.js";
import { Form16Service } from "./form16.service.js";
import { TaxDeclarationsService } from "./tax-declarations.service.js";
import { TaxSetupService } from "./tax-setup.service.js";

function pdfFile(file: { buffer: Buffer; fileName: string }) {
  return new StreamableFile(file.buffer, {
    type: "application/pdf",
    disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
  });
}

/** Tax masters — organization-wide configuration under the payroll-settings
 * permissions (like the settings themselves). */
@ApiTags("hr-payroll-tax-setup")
@Controller("hr/payroll")
export class TaxSetupController {
  constructor(private readonly service: TaxSetupService) {}

  @Get("tax-regimes")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "Income-tax regimes and slabs per financial year" })
  listRegimes(@Query() query: QueryTaxRegimeDto) {
    return this.service.listRegimes(query.financialYear);
  }

  @Put("tax-regimes")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({
    summary:
      "Create (version 0) or replace one regime's rules and slabs for a financial year",
  })
  upsertRegime(@Body() dto: UpsertTaxRegimeDto) {
    return this.service.upsertRegime(dto);
  }

  @Get("pt-slabs")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "Professional Tax slabs per state" })
  listPtSlabs(@Query() query: QueryPtSlabDto) {
    return this.service.listPtSlabs(query.stateCode);
  }

  @Post("pt-slabs")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({ summary: "Add a Professional Tax slab" })
  createPtSlab(@Body() dto: CreatePtSlabDto) {
    return this.service.createPtSlab(dto);
  }

  @Patch("pt-slabs/:id")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({ summary: "End or deactivate a Professional Tax slab" })
  updatePtSlab(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePtSlabDto,
  ) {
    return this.service.updatePtSlab(id, dto);
  }

  @Get("pt-location-states")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "The PT state of each work location" })
  listPtLocationStates() {
    return this.service.listPtLocationStates();
  }

  @Put("pt-location-states/:workLocationId")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({ summary: "Set the PT state of a work location" })
  setPtLocationState(
    @Param("workLocationId", ParseIntPipe) workLocationId: number,
    @Body() dto: SetPtLocationStateDto,
  ) {
    return this.service.setPtLocationState(workLocationId, dto.stateCode);
  }
}

/** HR side of tax declarations and Form 16 — team-scoped. */
@ApiTags("hr-tax-declarations")
@Controller("hr/tax-declarations")
export class TaxDeclarationsController {
  constructor(
    private readonly service: TaxDeclarationsService,
    private readonly form16: Form16Service,
  ) {}

  @Get()
  @RequireScopedPermission("hr.tax_declaration.read")
  @ApiOperation({ summary: "Tax declarations within the caller's scope" })
  findAll(@Paginate(QueryTaxDeclarationDto) query: QueryTaxDeclarationDto) {
    return this.service.findAll(query);
  }

  @Get("form16/:employeeId/:financialYear")
  @RequireScopedPermission("hr.tax_declaration.read")
  @ApiOperation({ summary: "Form 16 Part B data for an employee and year" })
  form16Data(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("financialYear") financialYear: string,
  ) {
    return this.form16.forHr(employeeId, financialYear);
  }

  @Get("form16/:employeeId/:financialYear/pdf")
  @RequireScopedPermission("hr.tax_declaration.read")
  @RawResponse()
  @ApiOperation({ summary: "Download Form 16 Part B as PDF" })
  async form16Pdf(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("financialYear") financialYear: string,
  ) {
    return pdfFile(
      await this.form16.pdf(await this.form16.forHr(employeeId, financialYear)),
    );
  }

  @Get(":id")
  @RequireScopedPermission("hr.tax_declaration.read")
  @ApiOperation({ summary: "One tax declaration" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put("employee/:employeeId/:financialYear")
  @RequireScopedPermission("hr.tax_declaration.write")
  @ApiOperation({
    summary: "Enter or correct a declaration on an employee's behalf",
  })
  saveForEmployee(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("financialYear") financialYear: string,
    @Body() dto: SaveTaxDeclarationDto,
  ) {
    return this.service.saveForEmployee(employeeId, financialYear, dto);
  }

  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.tax_declaration.approve")
  @ApiOperation({
    summary:
      "Verify (with the accepted amounts) or reject a submitted declaration",
  })
  verify(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VerifyTaxDeclarationDto,
  ) {
    return this.service.verify(id, dto);
  }
}

/** The employee's own declarations and Form 16. */
@ApiTags("employee-self-service-tax")
@Controller("self-service")
export class MyTaxController {
  constructor(
    private readonly service: TaxDeclarationsService,
    private readonly form16: Form16Service,
  ) {}

  @Get("tax-declarations")
  @RequirePermission("employee_self_service.tax_declaration.read")
  @ApiOperation({ summary: "My tax declarations" })
  findMine(@Query() query: QueryTaxRegimeDto) {
    return this.service.findMine(query.financialYear);
  }

  @Put("tax-declarations/:financialYear")
  @RequirePermission("employee_self_service.tax_declaration.write")
  @ApiOperation({
    summary: "Save (draft) or submit my tax declaration for a year",
  })
  saveMine(
    @Param("financialYear") financialYear: string,
    @Body() dto: SaveTaxDeclarationDto,
  ) {
    return this.service.saveMine(financialYear, dto);
  }

  @Get("form16/:financialYear")
  @RequirePermission("employee_self_service.form16.read")
  @ApiOperation({ summary: "My Form 16 Part B data" })
  myForm16(@Param("financialYear") financialYear: string) {
    return this.form16.forSelf(financialYear);
  }

  @Get("form16/:financialYear/pdf")
  @RequirePermission("employee_self_service.form16.read")
  @RawResponse()
  @ApiOperation({ summary: "Download my Form 16 Part B" })
  async myForm16Pdf(@Param("financialYear") financialYear: string) {
    return pdfFile(
      await this.form16.pdf(await this.form16.forSelf(financialYear)),
    );
  }
}
