import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class SearchDto {
  @ApiProperty({ description: "Free-text search across every SCM master" })
  @Trim()
  @IsString()
  @Length(1, 200)
  q!: string;
}

export class ResolveCodeDto {
  @ApiProperty({
    description:
      "A scanned/typed code: product, batch, serial or any document number",
  })
  @Trim()
  @IsString()
  @Length(1, 200)
  code!: string;
}

export class AskDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 500)
  question!: string;
}

export class MovementTrendDto {
  @ApiPropertyOptional({
    description: "Number of IST days ending today",
    minimum: 1,
    maximum: 31,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}
