import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Validated, bounded pagination params — never parse `page`/`limit` off
 * `req.query` by hand (Docs/CODING_STANDARDS.md §9). */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
