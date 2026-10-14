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
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreateSalaryComponentDto,
  CreateSalaryTemplateDto,
  PreviewSalaryTemplateDto,
  QuerySalaryComponentDto,
  UpdateSalaryComponentDto,
  UpdateSalaryTemplateDto,
} from "./dto/salary-component.dto.js";
import { SalaryComponentsService } from "./salary-components.service.js";

/** Organization-wide payroll masters — not employee data, so the exact
 * (unscoped) payroll-settings permissions, like the settings themselves. */
@ApiTags("hr-payroll-salary-components")
@Controller("hr/payroll")
export class SalaryComponentsController {
  constructor(private readonly service: SalaryComponentsService) {}

  @Get("salary-components")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "The organization's salary component list" })
  listComponents(@Query() query: QuerySalaryComponentDto) {
    return this.service.listComponents(query.includeInactive ?? false);
  }

  @Post("salary-components")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({ summary: "Add an earning or deduction component" })
  createComponent(@Body() dto: CreateSalaryComponentDto) {
    return this.service.createComponent(dto);
  }

  @Patch("salary-components/:id")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({
    summary:
      "Change a component's name, flags, order or active state (code and kind are fixed)",
  })
  updateComponent(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSalaryComponentDto,
  ) {
    return this.service.updateComponent(id, dto);
  }

  @Get("salary-templates")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "Salary templates (breakups per grade)" })
  listTemplates(@Query() query: QuerySalaryComponentDto) {
    return this.service.listTemplates(query.includeInactive ?? false);
  }

  @Get("salary-templates/:id")
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "One salary template with its lines" })
  getTemplate(@Param("id", ParseIntPipe) id: number) {
    return this.service.getTemplate(id);
  }

  @Post("salary-templates")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({ summary: "Create a salary template" })
  createTemplate(@Body() dto: CreateSalaryTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Patch("salary-templates/:id")
  @RequirePermission("hr.payroll_settings.write")
  @ApiOperation({
    summary:
      "Change a template (lines replaced when given; existing salaries are not changed)",
  })
  updateTemplate(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSalaryTemplateDto,
  ) {
    return this.service.updateTemplate(id, dto);
  }

  @Post("salary-templates/:id/preview")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("hr.payroll_settings.read")
  @ApiOperation({ summary: "What a template gives for a gross monthly salary" })
  preview(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PreviewSalaryTemplateDto,
  ) {
    return this.service.previewTemplate(id, dto.grossMonthly);
  }
}
