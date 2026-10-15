import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ActivitiesService } from "./activities.service.js";
import {
  CreateActivityDto,
  QueryActivityDto,
  UpdateActivityDto,
} from "./dto/activity.dto.js";

@ApiTags("crm-activities")
@Controller("crm/activities")
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @RequirePermission("crm.activity.read")
  findAll(@Paginate(QueryActivityDto) query: QueryActivityDto) {
    return this.activities.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.activity.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.activities.findOne(id);
  }

  @Post()
  @RequirePermission("crm.activity.write")
  create(@Body() dto: CreateActivityDto) {
    return this.activities.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.activity.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activities.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.activity.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.activities.remove(id);
  }
}
