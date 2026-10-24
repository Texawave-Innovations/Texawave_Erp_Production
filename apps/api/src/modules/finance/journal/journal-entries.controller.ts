import {
  Body,
  Controller,
  Delete,
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
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto.js";
import { QueryJournalEntriesDto } from "./dto/query-journal-entries.dto.js";
import { ReverseJournalEntryDto } from "./dto/reverse-journal-entry.dto.js";
import { UpdateJournalEntryDto } from "./dto/update-journal-entry.dto.js";
import { JournalEntriesService } from "./journal-entries.service.js";

@ApiTags("finance-journal-entries")
@Controller("finance/journal-entries")
export class JournalEntriesController {
  constructor(private readonly journalService: JournalEntriesService) {}

  @Get()
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary: "List journal vouchers with pagination, status, and date filters",
  })
  findAll(@Paginate(QueryJournalEntriesDto) query: QueryJournalEntriesDto) {
    return this.journalService.findAll(query);
  }

  @Get(":id")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary: "Get journal voucher by ID with lines and accounts",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.journalService.findOne(id);
  }

  @Post()
  @RequirePermission("finance.journal.write")
  @ApiOperation({ summary: "Create a new draft journal voucher" })
  create(@Body() dto: CreateJournalEntryDto) {
    return this.journalService.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.journal.write")
  @ApiOperation({ summary: "Update an existing draft journal voucher" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.update(id, dto);
  }

  @Post(":id/post")
  @RequirePermission("finance.journal.post")
  @ApiOperation({
    summary:
      "Post a draft journal voucher and atomically synchronize ledger balances",
  })
  post(@Param("id", ParseIntPipe) id: number) {
    return this.journalService.post(id);
  }

  @Post(":id/reverse")
  @RequirePermission("finance.journal.post")
  @ApiOperation({
    summary: "Reverse a posted journal voucher and restore account balances",
  })
  reverse(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReverseJournalEntryDto,
  ) {
    return this.journalService.reverse(id, dto);
  }

  @Delete(":id")
  @RequirePermission("finance.journal.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft journal voucher" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.journalService.remove(id);
  }
}
