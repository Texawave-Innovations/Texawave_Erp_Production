import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  CALCULATION_TYPES,
  type CalculationType,
} from "../salary-template.rules.js";

export const COMPONENT_KINDS = ["EARNING", "DEDUCTION"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateSalaryComponentDto {
  @ApiProperty({
    example: "SHIFT_ALLOWANCE",
    description:
      "Upper-case letters, digits and _ ; immutable. Engine codes (PF, ESI, PT, TDS, LOAN, BONUS, ARREARS, OVERTIME, GRATUITY) are reserved.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9_]{1,39}$/)
  code!: string;

  @ApiProperty({ example: "Shift Allowance" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: COMPONENT_KINDS })
  @IsIn(COMPONENT_KINDS)
  kind!: ComponentKind;

  @ApiPropertyOptional({
    default: true,
    description: "Reduced by loss-of-pay days",
  })
  @IsOptional()
  @IsBoolean()
  isProrated?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ default: false, description: "Part of the PF wage" })
  @IsOptional()
  @IsBoolean()
  pfApplicable?: boolean;

  @ApiPropertyOptional({ default: true, description: "Part of the ESI wage" })
  @IsOptional()
  @IsBoolean()
  esiApplicable?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  displayOrder?: number;
}

/** `code` and `kind` never change (existing salaries and payslips refer to
 * them); everything else may. */
export class UpdateSalaryComponentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isProrated?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsBoolean()
  pfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  esiApplicable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  displayOrder?: number;

  @ApiPropertyOptional({
    description:
      "Inactive components cannot be used in new salaries or templates; existing salaries keep them",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QuerySalaryComponentDto {
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  includeInactive?: boolean;
}

export class TemplateLineDto {
  @Type(() => Number)
  @IsInt()
  componentId!: number;

  @ApiProperty({ enum: CALCULATION_TYPES })
  @IsIn(CALCULATION_TYPES)
  calculationType!: CalculationType;

  @ApiPropertyOptional({
    description:
      "Rupees for FIXED; percent for PERCENT_OF_GROSS / PERCENT_OF_BASIC; ignored for REMAINDER",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  value?: number;
}

export class CreateSalaryTemplateDto {
  @ApiProperty({ example: "GRADE-A" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9_-]{1,39}$/)
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TemplateLineDto)
  lines!: TemplateLineDto[];
}

export class UpdateSalaryTemplateDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Replaces all lines when given" })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TemplateLineDto)
  lines?: TemplateLineDto[];
}

export class PreviewSalaryTemplateDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  grossMonthly!: number;
}
