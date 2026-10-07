import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateExitRequestDto,
  QueryMyExitRequestDto,
} from "../../hr/exit-requests/dto/exit-request.dto.js";
import { ExitRequestsService } from "../../hr/exit-requests/exit-requests.service.js";

/** The authenticated user's OWN exit requests. No employee id in any request:
 * "who am I" is resolved from the JWT (employee↔user mapping). There is no
 * cancel, withdraw or resubmit route: none exists in legacy. */
@ApiTags("employee-self-service")
@Controller("self-service/exit-requests")
export class MyExitRequestsController {
  constructor(private readonly exits: ExitRequestsService) {}

  @Get()
  @RequirePermission("employee_self_service.exit_request.read")
  @ApiOperation({ summary: "My exit requests" })
  findMine(@Paginate(QueryMyExitRequestDto) query: QueryMyExitRequestDto) {
    return this.exits.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.exit_request.read")
  @ApiOperation({ summary: "One of my exit requests" })
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.exits.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.exit_request.create")
  @ApiOperation({
    summary: "Submit an exit request for myself (starts SUBMITTED)",
  })
  create(@Body() dto: CreateExitRequestDto) {
    return this.exits.createForCurrentEmployee(dto);
  }
}
