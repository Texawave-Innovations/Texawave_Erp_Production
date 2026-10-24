import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches } from "class-validator";

export class QueryPeriodClosingDto {
  @ApiProperty({
    description: "Financial period in YYYY-MM format (e.g. 2026-10)",
    example: "2026-10",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(?:0[1-9]|1[0-2])$/, {
    message: "period must be formatted as YYYY-MM (e.g. 2026-10)",
  })
  period!: string;
}
