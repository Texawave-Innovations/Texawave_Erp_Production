import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class QueryHoursTrendDto {
  @ApiPropertyOptional({
    description: "Number of Monday-start weeks ending with the current week",
    minimum: 1,
    maximum: 26,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(26)
  weeks?: number;
}
