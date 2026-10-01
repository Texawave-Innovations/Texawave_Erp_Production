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
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateEmploymentTypeDto } from "./dto/create-employment-type.dto.js";
import { QueryEmploymentTypeDto } from "./dto/query-employment-type.dto.js";
import { UpdateEmploymentTypeDto } from "./dto/update-employment-type.dto.js";
import { EmploymentTypesService } from "./employment-types.service.js";

/** Employment types (Permanent, Contract, Temporary, Intern, …). Probation/notice days are stored but not yet enforced anywhere.
 * No DELETE route by design: rows are deactivated, never deleted, because
 * historical records keep referencing them. */
@ApiTags("master-data-employment-types")
@Controller("master-data/employment-types")
export class EmploymentTypesController {
  constructor(private readonly employmentTypes: EmploymentTypesService) {}

  @Get()
  @RequirePermission("master.employment_type.read")
  @ApiOperation({
    summary: "List employment types of the current organization",
  })
  findAll(@Paginate(QueryEmploymentTypeDto) query: QueryEmploymentTypeDto) {
    return this.employmentTypes.findAll(query);
  }

  @Get(":id")
  @RequirePermission("master.employment_type.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.employmentTypes.findOne(id);
  }

  @Post()
  @RequirePermission("master.employment_type.write")
  create(@Body() dto: CreateEmploymentTypeDto) {
    return this.employmentTypes.create(dto);
  }

  @Patch(":id")
  @RequirePermission("master.employment_type.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmploymentTypeDto,
  ) {
    return this.employmentTypes.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.employment_type.write")
  @ApiOperation({
    summary:
      "Deactivate — existing records keep it; new assignments are refused",
  })
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.employmentTypes.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.employment_type.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.employmentTypes.setActive(id, true);
  }
}
