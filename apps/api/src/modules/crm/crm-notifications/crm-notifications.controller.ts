import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CrmNotificationsService } from "./crm-notifications.service.js";
import {
  QueryCrmNotificationsDto,
  SnoozeCrmNotificationDto,
} from "./dto/crm-notification.dto.js";

/** Legacy `crm/notifications/feed` (bell + blocking action panel). Reads need
 * `crm.notification.read`; Acknowledge/Done/Snooze/Restore need `.write`;
 * Recycle-Bin delete and permanent delete are admin-only (`.delete`). */
@ApiTags("crm-notifications")
@Controller("crm/notifications")
export class CrmNotificationsController {
  constructor(private readonly notifications: CrmNotificationsService) {}

  @Get()
  @RequirePermission("crm.notification.read")
  findAll(@Query() query: QueryCrmNotificationsDto) {
    return this.notifications.findAll(query);
  }

  /** Generate / refresh the feed from the live CRM data (UI: on load + 60s). */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.read")
  refresh() {
    return this.notifications.refresh();
  }

  @Post(":id/acknowledge")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.write")
  acknowledge(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.acknowledge(id);
  }

  @Post(":id/done")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.write")
  done(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.markDone(id);
  }

  @Post(":id/snooze")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.write")
  snooze(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SnoozeCrmNotificationDto,
  ) {
    return this.notifications.snooze(id, dto);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.write")
  read(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.markRead(id);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.notification.write")
  restore(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.restore(id);
  }

  /** Move a Completed notification to the notification Recycle Bin. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("crm.notification.delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.remove(id).then(() => undefined);
  }

  /** Irreversibly delete a notification that is already in the Recycle Bin. */
  @Delete(":id/permanent")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("crm.notification.delete")
  purge(@Param("id", ParseIntPipe) id: number) {
    return this.notifications.purge(id);
  }
}
