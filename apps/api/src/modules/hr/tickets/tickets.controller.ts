import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateTicketCommentDto,
  CreateTicketDto,
  QueryTicketDto,
  UpdateTicketStatusDto,
} from "./dto/ticket.dto.js";
import { TicketsService } from "./tickets.service.js";

/** HR / admin employee tickets. Reads and writes are team-scoped by the
 * EMPLOYEE the ticket is about (`hr.ticket.read/write` are seeded `.own/.team/
 * .all`). Tickets are never deleted (none in legacy); a ticket is closed by
 * moving it to CLOSED. */
@ApiTags("hr-tickets")
@Controller("hr/tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireScopedPermission("hr.ticket.read")
  @ApiOperation({ summary: "Tickets in the caller's scope" })
  findAll(@Paginate(QueryTicketDto) query: QueryTicketDto) {
    return this.tickets.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.ticket.read")
  @ApiOperation({
    summary: "One ticket in scope, with its comments oldest first",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tickets.findOne(id);
  }

  @Post()
  @RequireScopedPermission("hr.ticket.write")
  @ApiOperation({ summary: "Raise a ticket for an employee in scope" })
  create(@Body() dto: CreateTicketDto) {
    return this.tickets.create(dto);
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.ticket.write")
  @ApiOperation({
    summary:
      "Move a ticket (OPEN, IN_PROGRESS, RESOLVED, CLOSED); a move back to OPEN from RESOLVED or CLOSED is a reopen",
  })
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.setStatus(id, dto);
  }

  @Post(":id/comments")
  @HttpCode(HttpStatus.CREATED)
  @RequireScopedPermission("hr.ticket.write")
  @ApiOperation({
    summary: "Reply to an open or in-progress ticket (append-only)",
  })
  addComment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateTicketCommentDto,
  ) {
    return this.tickets.addHrComment(id, dto);
  }
}
