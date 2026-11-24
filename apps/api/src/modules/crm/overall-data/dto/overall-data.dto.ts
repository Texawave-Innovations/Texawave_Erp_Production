import { FIELD_FORMAT } from "../../../../common/dto/field-formats.js";
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

  @Matches(FIELD_FORMAT.isoDate)
  day!: string;
}
