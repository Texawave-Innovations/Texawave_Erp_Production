import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  QueryExitRequestDto,
  UpdateExitRequestDto,
} from "./dto/exit-request.dto.js";
import { ExitRequestsService } from "./exit-requests.service.js";

/** HR surface. Reads are own/team/all. Reviewing, approving, rejecting and
 * completing need `hr.exit_request.decide` at team or all scope. Nobody may
 * decide their own request. Rejected and completed requests are final. Creating
 * or approving a request does NOT change the employee record (decision E2). */
@ApiTags("hr-exit-requests")
@Controller("hr/exit-requests")
export class ExitRequestsController {
  constructor(private readonly exits: ExitRequestsService) {}

  @Get()
  @RequireScopedPermission("hr.exit_request.read")
  @ApiOperation({ summary: "Exit requests in the caller's scope" })
  findAll(@Paginate(QueryExitRequestDto) query: QueryExitRequestDto) {
    return this.exits.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.exit_request.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.exits.findOne(id);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.exit_request.decide")
  @ApiOperation({
    summary:
      "Move a request along the transition map and/or set confirmed last working day, settlement status and HR note",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateExitRequestDto,
  ) {
    return this.exits.update(id, dto);
  }
}
