import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class ReconcileTransactionDto {
  @ApiPropertyOptional({
    description: "Matched FinanceJournalEntry ID to link during reconciliation",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  matchedJournalEntryId?: number;
}
