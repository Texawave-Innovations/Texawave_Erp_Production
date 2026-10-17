import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, Matches } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Extends PaginationDto only so the shared `@Paginate()` decorator can
 * validate it; the feed itself is not paginated. */
export class QueryCrmCalendarEventsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "YYYY-MM-DD, inclusive. Omit for no lower bound.",
  })
  @IsOptional()
  @Matches(DAY, { message: "from must be YYYY-MM-DD" })
  from?: string;

  @ApiPropertyOptional({ description: "YYYY-MM-DD, inclusive." })
  @IsOptional()
  @Matches(DAY, { message: "to must be YYYY-MM-DD" })
  to?: string;
}
