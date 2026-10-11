import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

/** 0–100 with at most two decimals. */
const Percent = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(100),
  );

/** A positive rupee amount. */
const Amount = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(1),
    Max(10_000_000),
  );

/** Partial: omitted fields keep their value. Basic + HRA + conveyance may not
 * exceed 100 (checked in the service and by a database CHECK). */
export class UpdatePayrollSettingsDto {
  @ApiProperty({
    description:
      "The `version` you last read (optimistic lock). Use 0 when no settings were saved yet (`isDefault: true`).",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @ApiPropertyOptional({ example: 35, description: "% of gross monthly" })
  @Percent()
  basicPercent?: number;

  @ApiPropertyOptional({ example: 30 })
  @Percent()
  hraPercent?: number;

  @ApiPropertyOptional({ example: 20 })
  @Percent()
  conveyancePercent?: number;

  @ApiPropertyOptional({ example: 15000, description: "Monthly PF wage cap" })
  @Amount()
  pfWageCeiling?: number;

  @ApiPropertyOptional({ example: 12 })
  @Percent()
  pfEmployeeRate?: number;

  @ApiPropertyOptional({ example: 12 })
  @Percent()
  pfEmployerRate?: number;

  @ApiPropertyOptional({
    example: 21000,
    description:
      "ESI applies when the recurring monthly wage is at or below this",
  })
  @Amount()
  esiWageThreshold?: number;

  @ApiPropertyOptional({ example: 0.75 })
  @Percent()
  esiEmployeeRate?: number;

  @ApiPropertyOptional({ example: 3.25 })
  @Percent()
  esiEmployerRate?: number;
}

export class SalarySplitQueryDto {
  @ApiProperty({ example: 40000 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  grossMonthly!: number;
}
