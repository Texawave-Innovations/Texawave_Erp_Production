import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class QueryMonthlyTrendDto {
  @ApiPropertyOptional({
    description: "Number of calendar months ending with the current month",
    minimum: 1,
    maximum: 24,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
