import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional } from "class-validator";

export const NOTIFICATION_TABS = ["active", "completed", "deleted"] as const;

export class QueryCrmNotificationsDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TABS })
  @IsOptional()
  @IsIn(NOTIFICATION_TABS as readonly string[])
  tab?: (typeof NOTIFICATION_TABS)[number];
}

export class SnoozeCrmNotificationDto {
  /** ISO timestamp the notification stays hidden until (legacy presets: +3h,
   * tomorrow 9 AM, next week, or a custom date-time). */
  @IsDateString()
  until!: string;
}
