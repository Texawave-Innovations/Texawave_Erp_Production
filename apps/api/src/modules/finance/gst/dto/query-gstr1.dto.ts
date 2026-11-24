import { FIELD_FORMAT } from "../../../../common/dto/field-formats.js";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, Matches } from "class-validator";

export class QueryGstr1Dto {
  @ApiProperty({
    example: "2026-10",
    description: "Tax period in YYYY-MM format",
  })
  @IsNotEmpty()
  @Matches(FIELD_FORMAT.month, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period!: string;
}
