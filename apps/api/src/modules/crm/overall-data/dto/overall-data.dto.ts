import { Type } from "class-transformer";
import { IsIn, IsInt, Matches, Max, Min } from "class-validator";
import { OVERALL_ROWS } from "../overall-data.derive.js";

export class QueryOverallDataDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

/** Drill-down: the records behind one (disposition row, day) cell. */
export class QueryOverallDataRecordsDto extends QueryOverallDataDto {
  @IsIn(OVERALL_ROWS.map((r) => r.key))
  row!: (typeof OVERALL_ROWS)[number]["key"];

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
}
