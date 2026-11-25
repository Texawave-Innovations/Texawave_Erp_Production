import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, Matches } from "class-validator";

export class SalesDashboardQueryDto {
  @ApiPropertyOptional({
    example: "2026",
    description:
      "Calendar year for the monthly trend and top clients (default: current year)",
  })
  @IsOptional()
  @Matches(/^20\d{2}$/, { message: "year must be a 4-digit year (20xx)" })
  year?: string;
}
