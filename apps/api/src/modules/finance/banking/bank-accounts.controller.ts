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
import { BankingService } from "./banking.service.js";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import { QueryBankAccountsDto } from "./dto/query-bank-accounts.dto.js";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

@ApiTags("finance-bank-accounts")
@Controller("finance/bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankingService: BankingService) {}

  @Get()
  @RequirePermission("finance.banking.read")
  @ApiOperation({
    summary: "List bank accounts with pagination, search, and status filters",
  })
  findAll(@Paginate(QueryBankAccountsDto) query: QueryBankAccountsDto) {
    return this.bankingService.findAllAccounts(query);
  }

  @Get(":id")
  @RequirePermission("finance.banking.read")
  @ApiOperation({ summary: "Get bank account details by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.bankingService.findAccountById(id);
  }

  @Post()
  @RequirePermission("finance.banking.write")
  @ApiOperation({ summary: "Create a new bank account" })
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankingService.createAccount(dto);
  }

  @Patch(":id")
  @RequirePermission("finance.banking.write")
  @ApiOperation({ summary: "Update bank account details" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankingService.updateAccount(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("finance.banking.write")
  @ApiOperation({ summary: "Soft delete a bank account" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.bankingService.deleteAccount(id);
  }
}
