import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateMyTicketDto,
  CreateTicketCommentDto,
  QueryMyTicketDto,
  UpdateMyTicketDto,
} from "../../hr/tickets/dto/ticket.dto.js";
import { TicketsService } from "../../hr/tickets/tickets.service.js";

/** The authenticated user's OWN tickets: raised by them, or raised by HR for
 * them. No employee id in any request — resolved from the JWT. */
@ApiTags("employee-self-service")
@Controller("self-service/tickets")
export class MyTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequirePermission("employee_self_service.ticket.read")
  @ApiOperation({ summary: "My tickets (raised by me or by HR for me)" })
  findMine(@Paginate(QueryMyTicketDto) query: QueryMyTicketDto) {
    return this.tickets.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.ticket.read")
  @ApiOperation({
    summary: "One of my tickets, with its comments oldest first",
  })
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.tickets.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.ticket.create")
  @ApiOperation({ summary: "Raise a ticket to HR" })
  create(@Body() dto: CreateMyTicketDto) {
    return this.tickets.createForCurrentEmployee(dto);
  }

  @Patch(":id")
  @RequirePermission("employee_self_service.ticket.update")
  @ApiOperation({
    summary:
      "Edit my own open ticket (category, subject and description together)",
  })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMyTicketDto,
  ) {
    return this.tickets.updateMine(id, dto);
  }

  @Post(":id/comments")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("employee_self_service.ticket.update")
  @ApiOperation({ summary: "Reply on a ticket HR raised for me (append-only)" })
  addComment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateTicketCommentDto,
  ) {
    return this.tickets.addMyComment(id, dto);
  }
}
