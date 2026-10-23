import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Extends PaginationDto only so the shared `@Paginate()` decorator can
 * validate it; the search itself is not paginated (per-kind caps apply). */
export class QueryCrmSearchDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Case-insensitive substring across company, contact, phone, email, opportunity number and salesperson",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;
}
