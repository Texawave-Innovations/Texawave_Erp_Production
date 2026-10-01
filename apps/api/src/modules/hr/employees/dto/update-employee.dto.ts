import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { PHONE_PATTERN } from "./create-employee.dto.js";
import { BlankToNull, LowerTrim } from "./employee-transforms.js";

/**
 * Partial update. Optional-and-clearable fields accept `null`; fields the
 * database requires (name, team, designation, employment type, joining date)
 * reject `null` — `@ValidateIf` skips a field only when it is *absent*.
 *
 * Not updatable here, by design: `employeeCode` (immutable), `status` and the
 * exit fields (lifecycle endpoints), `userId` (link/unlink endpoints).
 * `version` is required: the update is refused with 409 if the row changed
 * since the client read it.
 */
export class UpdateEmployeeDto {
  @ApiProperty({ description: "The `version` you last read (optimistic lock)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEmployeeDto) => o.fullName !== undefined)
  @Trim()
  @IsString()
  @Length(1, 200)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @BlankToNull()
  @LowerTrim()
  @IsEmail()
  @MaxLength(254)
  workEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @BlankToNull()
  @Trim()
  @Matches(PHONE_PATTERN, {
    message: "phone must be 6-20 digits/+()- characters",
  })
  phone?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEmployeeDto) => o.teamId !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number | null;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEmployeeDto) => o.designationId !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEmployeeDto) => o.employmentTypeId !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employmentTypeId?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reportsToId?: number | null;

  @ApiPropertyOptional({ example: "2026-10-01" })
  @ValidateIf((o: UpdateEmployeeDto) => o.dateOfJoining !== undefined)
  @IsDateOnly()
  dateOfJoining?: string;
}
