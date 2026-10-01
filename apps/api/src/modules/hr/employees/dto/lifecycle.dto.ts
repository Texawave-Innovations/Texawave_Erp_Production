import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from "../employee-status.policy.js";

/** Move an employee along the normal lifecycle (employee-status.policy.ts). */
export class ChangeEmployeeStatusDto {
  @ApiProperty({ enum: EMPLOYEE_STATUSES })
  @IsIn(EMPLOYEE_STATUSES)
  status!: EmployeeStatus;

  @ApiProperty({
    example: "2026-10-31",
    description:
      "When the change takes effect (YYYY-MM-DD). For RESIGNED/TERMINATED this is the last working day.",
  })
  @IsDateOnly()
  effectiveDate!: string;

  @ApiProperty({
    description: "Why — mandatory, kept in the status history and audit trail",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

/** Same body, different endpoint: the correction workflow is the only way out
 * of RESIGNED/TERMINATED and needs its own permission. */
export class CorrectEmployeeStatusDto extends ChangeEmployeeStatusDto {}

export class LinkEmployeeUserDto {
  @ApiProperty({
    description:
      "Existing platform user: same organization, active, not linked elsewhere",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  reason?: string;
}

export class UnlinkEmployeeUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
