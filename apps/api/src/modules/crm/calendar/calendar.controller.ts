import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CrmCalendarService } from "./calendar.service.js";
import { QueryCrmCalendarEventsDto } from "./dto/calendar.dto.js";

@ApiTags("crm-calendar")
@Controller("crm/calendar")
export class CrmCalendarController {
  constructor(private readonly calendar: CrmCalendarService) {}

  @Get("events")
  @RequirePermission("crm.calendar.read")
  events(
    @Paginate(QueryCrmCalendarEventsDto) query: QueryCrmCalendarEventsDto,
  ) {
    return this.calendar.events(query.from, query.to);
  }

  @Get("events/:type/:id")
  @RequirePermission("crm.calendar.read")
  event(@Param("type") type: string, @Param("id", ParseIntPipe) id: number) {
    return this.calendar.eventDetail(type, id);
  }
}
