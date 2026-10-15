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
  CompleteMeetingDto,
  CreateMeetingDto,
  QueryMeetingDto,
  RescheduleMeetingDto,
  UpdateMeetingDto,
  UpdateMeetingStatusDto,
} from "./dto/meeting.dto.js";
import { MeetingsService } from "./meetings.service.js";

@ApiTags("crm-meetings")
@Controller("crm/meetings")
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermission("crm.meeting.read")
  findAll(@Paginate(QueryMeetingDto) query: QueryMeetingDto) {
    return this.meetings.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.meeting.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.meetings.findOne(id);
  }

  @Post()
  @RequirePermission("crm.meeting.write")
  create(@Body() dto: CreateMeetingDto) {
    return this.meetings.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.meeting.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(id, dto);
  }

  @Patch(":id/status")
  @RequirePermission("crm.meeting.write")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMeetingStatusDto,
  ) {
    return this.meetings.updateStatus(id, dto);
  }

  @Post(":id/complete")
  @RequirePermission("crm.meeting.write")
  complete(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CompleteMeetingDto,
  ) {
    return this.meetings.complete(id, dto);
  }

  @Post(":id/reschedule")
  @RequirePermission("crm.meeting.write")
  reschedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetings.reschedule(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.meeting.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.meetings.remove(id);
  }
}
