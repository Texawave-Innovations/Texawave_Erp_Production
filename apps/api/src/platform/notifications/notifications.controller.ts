import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { SetDndDto } from "./dto/set-dnd.dto.js";
import { QueryNotificationsDto } from "./dto/query-notifications.dto.js";
import { NotificationsService } from "./notifications.service.js";

/** The caller's own inbox. Like `GET /menu/my-menu`, these routes need an
 * authenticated user but no permission: every query is keyed to the user in
 * the JWT, so there is nothing to grant. There is deliberately no create
 * route — only server-side code sends notifications. */
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "The caller's notifications, newest first" })
  findMine(@Paginate(QueryNotificationsDto) query: QueryNotificationsDto) {
    return this.notifications.findMine(query);
  }

  // Declared before `:id` routes so the literal path is never read as an id.
  @Get("unread-count")
  @ApiOperation({
    summary: "How many of the caller's notifications are unread",
  })
  unreadCount() {
    return this.notifications.unreadCount();
  }

  @Get("dnd")
  @ApiOperation({
    summary:
      "The caller's Do Not Disturb state (quiets the bell badge only; notifications are still stored)",
  })
  getDnd() {
    return this.notifications.getDnd();
  }

  @Put("dnd")
  @ApiOperation({
    summary:
      "Turn the caller's Do Not Disturb on (until a time within 7 days, or indefinite) or off",
  })
  setDnd(@Body() dto: SetDndDto) {
    return this.notifications.setDnd(dto);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all of the caller's notifications read" })
  markAllRead() {
    return this.notifications.markAllRead();
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark one of the caller's notifications read" })
  markRead(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.markRead(id);
  }
}
