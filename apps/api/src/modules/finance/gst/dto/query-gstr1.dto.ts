import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, Matches } from "class-validator";

export class QueryGstr1Dto {
  @ApiProperty({
    example: "2026-10",
    description: "Tax period in YYYY-MM format",
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period!: string;
}
