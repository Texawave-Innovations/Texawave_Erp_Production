import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

/** One line of a salary structure: a component (by id or code) and its
 * monthly amount. */
export class SalaryLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  componentId?: number;

  @ApiPropertyOptional({ example: "BASIC" })
  @IsOptional()
  @IsString()
  code?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  monthlyAmount!: number;
}

/**
 * A structure is given in ONE of these ways (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.0), in this order of precedence:
 *  1. `components` — the lines themselves, over the component master;
 *  2. `salaryTemplateId` + `grossMonthly` — the template's breakup;
 *  3. legacy fields `basic` + `hra` (+ conveyance, other, special);
 *  4. `grossMonthly` alone — split by the payroll settings' percentages.
 * The gross is always the sum of the earning lines.
 */
export class CreateSalaryDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @IsDateOnly()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  @ApiPropertyOptional({ type: [SalaryLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryLineDto)
  components?: SalaryLineDto[];

  @ApiPropertyOptional({ description: "Build the lines from this template" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salaryTemplateId?: number;

  @ApiPropertyOptional({
    description: "The revision letter this structure implements",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  revisionLetterId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basic?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conveyance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrearsSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossMonthly?: number;
}

export class UpdateSalaryDto {
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  @ApiPropertyOptional({
    type: [SalaryLineDto],
    description: "Replaces every line when given",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryLineDto)
  components?: SalaryLineDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basic?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conveyance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrearsSalary?: number;
}

export class QuerySalaryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsDateOnly()
  effectiveOn?: string;
}
