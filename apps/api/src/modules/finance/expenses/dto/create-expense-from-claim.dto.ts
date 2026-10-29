import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class CreateExpenseFromClaimDto {
  @ApiPropertyOptional({
    example: 10,
    description:
      "GL Account ID in Chart of Accounts to charge the reimbursement to",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  glAccountId?: number;

  @ApiPropertyOptional({
    example: 2,
    description: "Payment mode ID in Finance Master List (e.g. Bank Transfer)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  paymentModeId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Bank account ID used to disburse reimbursement",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  bankAccountId?: number;

  @ApiPropertyOptional({
    example: "Employee travel claim reimbursement approved by manager",
    description: "Additional notes for the finance expense record",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
