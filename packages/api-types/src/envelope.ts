// HANDWRITTEN — see packages/api-types/README.md. Mirrors
// apps/api/src/common/interceptors/response.interceptor.ts and
// apps/api/src/common/filters/all-exceptions.filter.ts. If either of those
// change shape, update these types in the same PR — nothing generates them
// yet (Docs/ARCHITECTURE.md §2).

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: PaginationMeta;
}

/** Shape of `AllExceptionsFilter`'s response body. */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  correlationId?: string;
}
