import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class VoidPaymentMadeDto {
  @ApiPropertyOptional({
    description:
      "Why this disbursement is being voided. Required when the payment " +
      "is linked to an SCM supplier payment, since that void needs a reason too.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
