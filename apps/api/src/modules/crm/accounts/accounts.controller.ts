import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { AccountsService } from "./accounts.service.js";
import {
  CreateAccountDto,
  QueryAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

/** Minimal CRM Account foundation (Phase 4B) — organization-wide reference
 * data (the required parent of a Contact), no team dimension. Only the
 * fields the legacy Contacts.tsx actually reads (`id`, `name`) are modeled;
 * the full Account-360 feature set is explicitly out of scope. */
@ApiTags("crm-accounts")
@Controller("crm/accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission("crm.account.read")
  @ApiOperation({ summary: "List CRM accounts (search by name)" })
  findAll(@Paginate(QueryAccountDto) query: QueryAccountDto) {
    return this.accounts.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.account.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.accounts.findOne(id);
  }

  @Post()
  @RequirePermission("crm.account.write")
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.account.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(id, dto);
  }
}
