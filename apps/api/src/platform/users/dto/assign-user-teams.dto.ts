import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  ValidateNested,
} from "class-validator";

export class TeamAssignmentItem {
  @ApiProperty({ example: 1 })
  @IsInt()
  teamId!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

export class AssignUserTeamsDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: "Team IDs within the caller's organization",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  teamIds?: number[];

  @ApiPropertyOptional({
    type: [TeamAssignmentItem],
    description: "Detailed team assignments with optional isLead flag",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamAssignmentItem)
  teams?: TeamAssignmentItem[];
}
