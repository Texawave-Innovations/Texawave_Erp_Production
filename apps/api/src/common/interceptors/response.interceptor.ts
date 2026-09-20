import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RAW_RESPONSE_KEY } from "../decorators/raw-response.decorator.js";
import { PaginatedResponseDto } from "../dto/paginated-response.dto.js";

interface Envelope {
  data: unknown;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Wraps every successful response as `{ data, meta }` (Docs/CODING_STANDARDS.md
 * §9). Detects a `PaginatedResponseDto` via `instanceof` and unwraps it into
 * `data: items` + pagination `meta`. Routes marked `@RawResponse()` pass
 * through untouched — health checks, file downloads, streams, redirects, 204s.
 *
 * Deliberately untyped over the controller's actual return type (`unknown`
 * throughout) rather than trying to thread a generic through the
 * `instanceof` narrowing below — `PaginatedResponseDto<T>`'s own `T` is
 * erased at runtime, so a generic here would be cosmetic, not a real safety
 * guarantee.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  Envelope | unknown
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<Envelope | unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result): Envelope => {
        if (result instanceof PaginatedResponseDto) {
          return {
            data: result.items,
            meta: {
              page: result.page,
              limit: result.limit,
              total: result.total,
              totalPages: result.totalPages,
            },
          };
        }
        return { data: result };
      }),
    );
  }
}
