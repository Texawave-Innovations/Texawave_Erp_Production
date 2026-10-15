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
import { AccountsService } from "./accounts.service.js";
import {
  ChangeAccountStatusTagDto,
  CreateAccountDto,
  QueryAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

/** Account-360 foundation (Phase 0, Docs/CRM_FULL_LEGACY_PARITY.md §4) —
 * expanded from the Phase 4B minimal `{id,name}` foundation. */
@ApiTags("crm-accounts")
@Controller("crm/accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission("crm.account.read")
  @ApiOperation({
    summary: "List CRM accounts (search by name, filter by status tag)",
  })
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

  @Patch(":id/status-tag")
  @RequirePermission("crm.account.write")
  @ApiOperation({
    summary:
      "Change the account's engagement-posture status tag (Interested/Not Interested/Keep in Touch/Call Back/Send Info)",
  })
  changeStatusTag(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ChangeAccountStatusTagDto,
  ) {
    return this.accounts.changeStatusTag(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.account.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Soft-delete an account, cascading to its contacts/opportunities/quotations/notes",
  })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.accounts.remove(id);
  }
}
