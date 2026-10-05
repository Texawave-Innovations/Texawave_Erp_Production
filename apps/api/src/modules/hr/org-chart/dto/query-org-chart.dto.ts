import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export const ORG_CHART_MAX_DEPTH = 10;
export const ORG_CHART_DEFAULT_DEPTH = ORG_CHART_MAX_DEPTH;

export class QueryOrgChartDto {
  @ApiPropertyOptional({
    description: "Limit the chart to one department's employees",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({
    description:
      "Return only this employee's subtree (for expanding a collapsed branch)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rootEmployeeId?: number;

  @ApiPropertyOptional({
    default: ORG_CHART_DEFAULT_DEPTH,
    minimum: 1,
    maximum: ORG_CHART_MAX_DEPTH,
    description:
      "Levels to return, root level included. Deeper reports are cut off; " +
      "`directReportCount` shows which nodes have more below them.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORG_CHART_MAX_DEPTH)
  depth?: number;
}
