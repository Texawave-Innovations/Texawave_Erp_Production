import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { QueryCrmSearchDto } from "./dto/search.dto.js";
import { CrmSearchService } from "./search.service.js";

@ApiTags("crm-search")
@Controller("crm/search")
export class CrmSearchController {
  constructor(private readonly search: CrmSearchService) {}

  @Get()
  @RequirePermission("crm.search.read")
  find(@Paginate(QueryCrmSearchDto) query: QueryCrmSearchDto) {
    return this.search.search(query.q);
  }
}
