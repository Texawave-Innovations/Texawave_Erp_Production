import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { Request } from "express";
import { PaginationDto } from "../dto/pagination.dto.js";

/**
 * Controller PARAMETER decorator — pulls `page`/`limit`/`order` (plus
 * whatever else the target DTO declares) off the query string into a
 * validated instance. Distinct from `@OrgScoped()`, which is a REPOSITORY
 * METHOD decorator and never appears on a controller
 * (Docs/CODING_STANDARDS.md §9).
 *
 * Defaults to `PaginationDto`; a module extending it with extra filter
 * fields (search, status, ...) MUST pass its own DTO class explicitly, or
 * those fields silently won't be validated/typed at runtime:
 *
 * ```ts
 * findAll(@Paginate(QueryTagDto) query: QueryTagDto) { ... }
 * ```
 */
export const Paginate = createParamDecorator(
  (
    dtoClass: (new () => PaginationDto) | undefined,
    ctx: ExecutionContext,
  ): PaginationDto => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const dto = plainToInstance(dtoClass ?? PaginationDto, request.query);
    const errors = validateSync(dto);
    if (errors.length > 0) {
      throw new BadRequestException(
        errors.map((e) => Object.values(e.constraints ?? {})).flat(),
      );
    }
    return dto;
  },
);
