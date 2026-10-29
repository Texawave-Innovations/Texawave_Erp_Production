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
import { CreateAccountDto } from "./dto/create-account.dto.js";
import { QueryAccountsDto } from "./dto/query-accounts.dto.js";
import { UpdateAccountDto } from "./dto/update-account.dto.js";

@ApiTags("finance-accounts")
@Controller("finance/accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission("finance.coa.read")
  @ApiOperation({
    summary: "List Chart of Accounts with pagination and filtering",
  })
  findAll(@Paginate(QueryAccountsDto) query: QueryAccountsDto) {
    return this.accounts.findAll(query);
  }

  @Get("tree")
  @RequirePermission("finance.coa.read")
  @ApiOperation({ summary: "Get complete Chart of Accounts hierarchical tree" })
  getTree() {
    return this.accounts.getTree();
  }

  @Get(":id")
  @RequirePermission("finance.coa.read")
  @ApiOperation({ summary: "Get Chart of Accounts entry by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.accounts.findOne(id);
  }

  @Post()
  @RequirePermission("finance.coa.write")
  @ApiOperation({ summary: "Create new Chart of Accounts entry" })
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.coa.write")
  @ApiOperation({ summary: "Update Chart of Accounts entry" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("finance.coa.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete Chart of Accounts entry" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.accounts.remove(id);
  }
}
