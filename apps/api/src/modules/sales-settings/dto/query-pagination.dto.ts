import { PaginationDto } from "../../../common/dto/pagination.dto.js";

/** Plain pagination, no extra filter fields — used by resources that have no
 * search/filter yet (seals, signatures). */
export class QueryPaginationDto extends PaginationDto {}
