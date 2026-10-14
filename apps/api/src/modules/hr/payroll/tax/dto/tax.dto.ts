import { applyDecorators } from "@nestjs/common";
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
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";
import {
  TAX_REGIMES,
  type TaxRegime,
} from "../../settings/payroll-settings.rules.js";

export const FINANCIAL_YEAR = /^[0-9]{4}-[0-9]{2}$/;

/** A non-negative rupee amount. */
const Rupees = (optional = true) =>
  applyDecorators(
    ...(optional ? [IsOptional()] : []),
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(1_000_000_000),
  );

const Percent = () =>
  applyDecorators(
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(100),
  );

// ---- income-tax regimes ---------------------------------------------------------

export class TaxSlabDto {
  @Rupees(false)
  fromIncome!: number;

  @ApiPropertyOptional({ nullable: true, description: "null = no upper limit" })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  toIncome?: number | null;

  @Percent()
  ratePercent!: number;
}

/** The rules of one regime for one financial year, entered from the
 * Finance Act. `version` 0 creates; otherwise the version last read. */
export class UpsertTaxRegimeDto {
  @ApiProperty({ example: "2026-27" })
  @Matches(FINANCIAL_YEAR)
  financialYear!: string;

  @ApiProperty({ enum: TAX_REGIMES })
  @IsIn(TAX_REGIMES)
  regime!: TaxRegime;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @Rupees(false)
  standardDeduction!: number;

  @Rupees(false)
  rebateIncomeLimit!: number;

  @Rupees(false)
  rebateMaxAmount!: number;

  @Percent()
  cessPercent!: number;

  @Rupees()
  section80cLimit?: number;

  @Rupees()
  homeLoanInterestLimit?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaxSlabDto)
  slabs!: TaxSlabDto[];
}

export class QueryTaxRegimeDto {
  @IsOptional()
  @Matches(FINANCIAL_YEAR)
  financialYear?: string;
}

// ---- professional tax -------------------------------------------------------------

const StateCode = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === "string" ? value.trim().toUpperCase() : value,
    ),
    Matches(/^[A-Z]{2,3}$/),
  );

export class CreatePtSlabDto {
  @ApiProperty({ example: "TN" })
  @StateCode()
  stateCode!: string;

  @Rupees(false)
  minMonthlyWage!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  maxMonthlyWage?: number | null;

  @Rupees(false)
  monthlyAmount!: number;

  @ApiPropertyOptional({ description: "Month (1-12) with a different amount" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  specialMonth?: number;

  @Rupees()
  specialAmount?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: "Months it is deducted in; empty = every month",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  applicableMonths?: number[];

  @IsDateOnly()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;
}

export class UpdatePtSlabDto {
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryPtSlabDto {
  @IsOptional()
  @StateCode()
  stateCode?: string;
}

export class SetPtLocationStateDto {
  @StateCode()
  stateCode!: string;
}

// ---- declarations -----------------------------------------------------------------

/** What an employee declares for a year (all amounts annual). */
export class TaxDeclarationAmountsDto {
  @ApiProperty({ enum: TAX_REGIMES })
  @IsIn(TAX_REGIMES)
  regime!: TaxRegime;

  @Rupees()
  section80c?: number;

  @Rupees()
  section80d?: number;

  @Rupees()
  hraExemption?: number;

  @Rupees()
  homeLoanInterest?: number;

  @Rupees()
  otherDeductions?: number;

  @Rupees()
  otherIncome?: number;

  @Rupees()
  previousEmployerIncome?: number;

  @Rupees()
  previousEmployerTds?: number;
}

export class SaveTaxDeclarationDto extends TaxDeclarationAmountsDto {
  @ApiProperty({
    description: "0 for a new declaration, else the version last read",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @ApiPropertyOptional({
    description: "Submit for verification (otherwise saved as a draft)",
  })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

/** HR's check against proofs: the accepted amounts (default: as declared). */
export class VerifyTaxDeclarationDto {
  @IsIn(["VERIFIED", "REJECTED"])
  decision!: "VERIFIED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note?: string;

  @Rupees()
  verifiedSection80c?: number;

  @Rupees()
  verifiedSection80d?: number;

  @Rupees()
  verifiedHraExemption?: number;

  @Rupees()
  verifiedHomeLoanInterest?: number;

  @Rupees()
  verifiedOtherDeductions?: number;
}

export class QueryTaxDeclarationDto extends PaginationDto {
  @IsOptional()
  @Matches(FINANCIAL_YEAR)
  financialYear?: string;

  @IsOptional()
  @IsIn(["DRAFT", "SUBMITTED", "VERIFIED", "REJECTED"])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;
}
