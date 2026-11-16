import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Matches, Min } from "class-validator";
import { AUTO_CHECKOUT_TIME_PATTERN } from "../attendance-settings.rules.js";

/** Partial: omitted fields keep their value. */
export class UpdateAttendanceSettingsDto {
  @ApiProperty({
    description:
      "The `version` you last read (optimistic lock). Use 0 when no settings were saved yet (`isDefault: true`).",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @ApiPropertyOptional({
    description:
      "Turn the fixed automatic check-out on or off. When off, the shift-target rule applies.",
  })
  @IsOptional()
  @IsBoolean()
  autoCheckoutEnabled?: boolean;

  @ApiPropertyOptional({
    example: "20:00",
    description:
      "Cut-off time (24-hour HH:mm, IST). Open sessions are closed at this time on their own date.",
  })
  @IsOptional()
  @Matches(AUTO_CHECKOUT_TIME_PATTERN, {
    message: "autoCheckoutTime must be a 24-hour HH:mm time",
  })
  autoCheckoutTime?: string;
}
