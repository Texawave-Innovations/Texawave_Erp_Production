import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";
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
