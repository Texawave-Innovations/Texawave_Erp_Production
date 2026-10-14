import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
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
  ValidateIf,
} from "class-validator";
import {
  PAY_DAYS_MODES,
  type PayDaysMode,
  TAX_REGIMES,
  type TaxRegime,
} from "../payroll-settings.rules.js";

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

const Flag = () => applyDecorators(IsOptional(), IsBoolean());

/** Free text; `null` or an empty string clears it. */
const Text = (max: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    ),
    ValidateIf((_o, v) => v !== null),
    IsString(),
    MaxLength(max),
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

  // ---- pay-days, attendance, overtime ---------------------------------------

  @ApiPropertyOptional({
    enum: PAY_DAYS_MODES,
    description:
      "Per-day divisor: calendar days, a fixed 30 or 26, or the month's working days",
  })
  @IsOptional()
  @IsIn(PAY_DAYS_MODES)
  payDaysMode?: PayDaysMode;

  @ApiPropertyOptional({
    description:
      "Use the employee's APPROVED attendance month (absences, half days, overtime). A run refuses employees whose month is not approved.",
  })
  @Flag()
  useAttendance?: boolean;

  @ApiPropertyOptional({
    description: "A working day with no attendance counts as an absence",
  })
  @Flag()
  unmarkedDaysAsAbsent?: boolean;

  @ApiPropertyOptional()
  @Flag()
  overtimeEnabled?: boolean;

  @ApiPropertyOptional({
    example: 70,
    nullable: true,
    description:
      "Fixed rupees per overtime hour; null = hourly wage × overtimeMultiplier",
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  overtimeRatePerHour?: number | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10)
  overtimeMultiplier?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(1)
  @Max(24)
  standardHoursPerDay?: number;

  // ---- PF split ---------------------------------------------------------------

  @ApiPropertyOptional({
    description:
      "true: PF on the wage up to the ceiling; false: PF on the full PF wage (voluntary)",
  })
  @Flag()
  pfCapAtCeiling?: boolean;

  @ApiPropertyOptional({ example: 8.33 })
  @Percent()
  epsRate?: number;

  @ApiPropertyOptional({ example: 15000 })
  @Amount()
  epsWageCeiling?: number;

  @ApiPropertyOptional({ example: 58 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(18)
  @Max(100)
  epsAgeLimit?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @Percent()
  edliRate?: number;

  @ApiPropertyOptional({ example: 15000 })
  @Amount()
  edliWageCeiling?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @Percent()
  pfAdminRate?: number;

  // ---- PT, TDS ----------------------------------------------------------------

  @ApiPropertyOptional()
  @Flag()
  ptEnabled?: boolean;

  @ApiPropertyOptional({
    example: "TN",
    nullable: true,
    description:
      "State whose PT slabs apply where a work location has no state mapped",
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^[A-Z]{2,3}$/)
  ptDefaultStateCode?: string | null;

  @ApiPropertyOptional()
  @Flag()
  tdsEnabled?: boolean;

  @ApiPropertyOptional({ enum: TAX_REGIMES })
  @IsOptional()
  @IsIn(TAX_REGIMES)
  defaultTaxRegime?: TaxRegime;

  // ---- statutory bonus, gratuity, loans ---------------------------------------

  @ApiPropertyOptional({ example: 21000 })
  @Amount()
  bonusEligibilityLimit?: number;

  @ApiPropertyOptional({ example: 7000 })
  @Amount()
  bonusCalculationCeiling?: number;

  @ApiPropertyOptional({ example: 8.33 })
  @Percent()
  bonusPercent?: number;

  @ApiPropertyOptional({ example: 2000000 })
  @Amount()
  gratuityCap?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  gratuityMinYears?: number;

  @ApiPropertyOptional({
    example: 3,
    description: "Max principal as a multiple of gross monthly salary",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  loanMaxMultiple?: number;

  @ApiPropertyOptional({
    example: 100,
    description: "All EMIs together may not exceed this % of gross monthly",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  loanMaxEmiPercent?: number;

  // ---- employer details ---------------------------------------------------------

  @ApiPropertyOptional({ nullable: true })
  @Text(200)
  companyName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Text(500)
  companyAddress?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "33ABCDE1234F1Z5" })
  @Text(15)
  companyGstin?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "ABCDE1234F" })
  @Text(10)
  companyPan?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "CHEA12345B" })
  @Text(10)
  companyTan?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Text(30)
  pfEstablishmentCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Text(30)
  esiEmployerCode?: string | null;
}

export class SalarySplitQueryDto {
  @ApiProperty({ example: 40000 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  grossMonthly!: number;
}
