import { FIELD_FORMAT } from "../../../../common/dto/field-formats.js";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches } from "class-validator";

export class QueryPeriodClosingDto {
  @ApiProperty({
    description: "Financial period in YYYY-MM format (e.g. 2026-10)",
    example: "2026-10",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(FIELD_FORMAT.month, {
    message: "period must be formatted as YYYY-MM (e.g. 2026-10)",
  })
  period!: string;
}
