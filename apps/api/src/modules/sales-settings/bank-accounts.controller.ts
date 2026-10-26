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
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { BankAccountsService } from "./bank-accounts.service.js";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import { QueryBankAccountDto } from "./dto/query-bank-account.dto.js";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

/** Bank & Signatory tab (bank half) of Sales Settings. */
@ApiTags("sales-settings-bank-accounts")
@Controller("sales-settings/bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankAccounts: BankAccountsService) {}

  @Get()
  @RequirePermission("sales_settings.bank_account.read")
  findAll(@Paginate(QueryBankAccountDto) query: QueryBankAccountDto) {
    return this.bankAccounts.findAll(query);
  }

  @Get(":id")
  @RequirePermission("sales_settings.bank_account.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.bankAccounts.findOne(id);
  }

  @Post()
  @RequirePermission("sales_settings.bank_account.write")
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankAccounts.create(dto);
  }

  @Patch(":id")
  @RequirePermission("sales_settings.bank_account.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccounts.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("sales_settings.bank_account.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.bankAccounts.remove(id);
  }
}
