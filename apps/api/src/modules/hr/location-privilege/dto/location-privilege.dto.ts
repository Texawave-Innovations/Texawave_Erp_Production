import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIP,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export const LOCATION_MODES = ["OFFICE", "REMOTE"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

/** OFFICE requires the office network on check-in/out. REMOTE exempts the
 * punch from that check. */
export class SetLocationPrivilegeDto {
  @ApiProperty({ enum: LOCATION_MODES })
  @IsIn(LOCATION_MODES)
  mode!: LocationMode;
}

export class CreateOfficeNetworkDto {
  @ApiProperty({ example: "203.0.113.10" })
  @IsIP()
  ipAddress!: string;

  @ApiPropertyOptional({ example: "Head office router" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class UpdateOfficeNetworkDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
