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
import {
  CreateFollowUpDto,
  QueryFollowUpDto,
  RescheduleFollowUpDto,
  UpdateFollowUpDto,
  UpdateFollowUpStatusDto,
} from "./dto/follow-up.dto.js";
import { FollowUpsService } from "./follow-ups.service.js";

@ApiTags("crm-follow-ups")
@Controller("crm/follow-ups")
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  @Get()
  @RequirePermission("crm.followup.read")
  findAll(@Paginate(QueryFollowUpDto) query: QueryFollowUpDto) {
    return this.followUps.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.followup.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.followUps.findOne(id);
  }

  @Post()
  @RequirePermission("crm.followup.write")
  create(@Body() dto: CreateFollowUpDto) {
    return this.followUps.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.followup.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFollowUpDto,
  ) {
    return this.followUps.update(id, dto);
  }

  @Patch(":id/status")
  @RequirePermission("crm.followup.write")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFollowUpStatusDto,
  ) {
    return this.followUps.updateStatus(id, dto);
  }

  @Post(":id/reschedule")
  @RequirePermission("crm.followup.write")
  reschedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RescheduleFollowUpDto,
  ) {
    return this.followUps.reschedule(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.followup.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.followUps.remove(id);
  }
}
