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
import { CreateDesignationDto } from "./dto/create-designation.dto.js";
import { QueryDesignationDto } from "./dto/query-designation.dto.js";
import { UpdateDesignationDto } from "./dto/update-designation.dto.js";
import { DesignationsService } from "./designations.service.js";

/** Job titles (e.g. Software Engineer). Referenced by employees.
 * No DELETE route by design: rows are deactivated, never deleted, because
 * historical records keep referencing them. */
@ApiTags("master-data-designations")
@Controller("master-data/designations")
export class DesignationsController {
  constructor(private readonly designations: DesignationsService) {}

  @Get()
  @RequirePermission("master.designation.read")
  @ApiOperation({ summary: "List designations of the current organization" })
  findAll(@Paginate(QueryDesignationDto) query: QueryDesignationDto) {
    return this.designations.findAll(query);
  }

  @Get(":id")
  @RequirePermission("master.designation.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.designations.findOne(id);
  }

  @Post()
  @RequirePermission("master.designation.write")
  create(@Body() dto: CreateDesignationDto) {
    return this.designations.create(dto);
  }

  @Patch(":id")
  @RequirePermission("master.designation.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.designations.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.designation.write")
  @ApiOperation({
    summary:
      "Deactivate — existing records keep it; new assignments are refused",
  })
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.designations.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.designation.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.designations.setActive(id, true);
  }
}
