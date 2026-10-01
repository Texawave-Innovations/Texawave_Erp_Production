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
import { CreateWorkLocationDto } from "./dto/create-work-location.dto.js";
import { QueryWorkLocationDto } from "./dto/query-work-location.dto.js";
import { UpdateWorkLocationDto } from "./dto/update-work-location.dto.js";
import { WorkLocationsService } from "./work-locations.service.js";

/** Work locations (offices/sites). Optional on employees and holidays.
 * No DELETE route by design: rows are deactivated, never deleted, because
 * historical records keep referencing them. */
@ApiTags("master-data-work-locations")
@Controller("master-data/work-locations")
export class WorkLocationsController {
  constructor(private readonly workLocations: WorkLocationsService) {}

  @Get()
  @RequirePermission("master.work_location.read")
  @ApiOperation({ summary: "List work locations of the current organization" })
  findAll(@Paginate(QueryWorkLocationDto) query: QueryWorkLocationDto) {
    return this.workLocations.findAll(query);
  }

  @Get(":id")
  @RequirePermission("master.work_location.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.workLocations.findOne(id);
  }

  @Post()
  @RequirePermission("master.work_location.write")
  create(@Body() dto: CreateWorkLocationDto) {
    return this.workLocations.create(dto);
  }

  @Patch(":id")
  @RequirePermission("master.work_location.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWorkLocationDto,
  ) {
    return this.workLocations.update(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.work_location.write")
  @ApiOperation({
    summary:
      "Deactivate — existing records keep it; new assignments are refused",
  })
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.workLocations.setActive(id, false);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("master.work_location.write")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.workLocations.setActive(id, true);
  }
}
