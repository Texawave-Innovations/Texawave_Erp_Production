/** Returned by a service/repository for a list endpoint. `ResponseInterceptor`
 * detects this shape via `instanceof` and unwraps it into
 * `{ data: items, meta: { page, limit, total, totalPages } }`
 * (Docs/CODING_STANDARDS.md §9). */
export class PaginatedResponseDto<T> {
  constructor(
    public readonly items: T[],
    public readonly total: number,
    public readonly page: number,
    public readonly limit: number,
  ) {}

  get totalPages(): number {
    return this.limit > 0 ? Math.ceil(this.total / this.limit) : 0;
  }
}
