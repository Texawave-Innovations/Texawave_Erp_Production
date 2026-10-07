import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** The six categories of legacy `EXPENSE_TYPES` (ExpenseApprovals.tsx). */
export const EXPENSE_TYPES = [
  "Travel",
  "Food",
  "Accommodation",
  "Office Supplies",
  "Medical",
  "Other",
] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

/** The three legacy statuses (`ExpenseStatus` in ExpenseApprovals.tsx). */
export const EXPENSE_CLAIM_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number];

/** Legacy `type="number"` input: no maximum, decimals allowed. The upper bound
 * here is the NUMERIC(12,2) column limit, so an overflow is a 400, not a 500. */
const MAX_AMOUNT = 9999999999.99;

/** There is deliberately NO `employeeId`: a claim is always for the
 * authenticated user's own employee record, resolved server-side from the JWT. */
export class CreateExpenseClaimDto {
  @ApiProperty({ enum: EXPENSE_TYPES })
  @IsIn(EXPENSE_TYPES)
  expenseType!: ExpenseType;

  @ApiProperty({
    example: 1250.5,
    description: "Greater than 0, at most 2 decimals",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({
    example: "2026-10-05",
    description: "Day the expense was incurred; not in the future",
  })
  @IsDateOnly()
  expenseDate!: string;

  @ApiProperty({ description: "What the expense was for (legacy max 300)" })
  @Trim()
  @IsString()
  @Length(1, 300)
  description!: string;

  @ApiPropertyOptional({
    example: "INV-1234",
    description:
      "Free-text receipt or bill reference. No file upload (legacy has none).",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  receiptRef?: string;
}

/** Decision by HR. The note is optional, as in the legacy screen. */
export class DecideExpenseClaimDto {
  @ApiProperty({ enum: ["APPROVED", "REJECTED"] })
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ description: "Optional note to the employee" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 500)
  note?: string;
}

class ExpenseClaimFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPENSE_CLAIM_STATUSES })
  @IsOptional()
  @IsIn(EXPENSE_CLAIM_STATUSES)
  status?: ExpenseClaimStatus;

  @ApiPropertyOptional({ enum: EXPENSE_TYPES })
  @IsOptional()
  @IsIn(EXPENSE_TYPES)
  expenseType?: ExpenseType;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Claims on or after this day",
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Claims on or before this day",
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

/** HR list: scoped by `hr.expense_claim.read`. */
export class QueryExpenseClaimDto extends ExpenseClaimFilterDto {
  @ApiPropertyOptional({ description: "Claims of one employee (within scope)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** Self-service list: always the caller's own claims. */
export class QueryMyExpenseClaimDto extends ExpenseClaimFilterDto {}
