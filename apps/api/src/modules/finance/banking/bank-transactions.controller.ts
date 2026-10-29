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
import { BankingService } from "./banking.service.js";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto.js";
import { QueryBankTransactionsDto } from "./dto/query-bank-transactions.dto.js";
import { ReconcileTransactionDto } from "./dto/reconcile-transaction.dto.js";

@ApiTags("finance-bank-transactions")
@Controller("finance/bank-transactions")
export class BankTransactionsController {
  constructor(private readonly bankingService: BankingService) {}

  @Get()
  @RequirePermission("finance.banking.read")
  @ApiOperation({
    summary:
      "List bank transactions with filtering by bank account, type, date range, and reconciliation",
  })
  findAll(@Paginate(QueryBankTransactionsDto) query: QueryBankTransactionsDto) {
    return this.bankingService.findAllTransactions(query);
  }

  @Get(":id")
  @RequirePermission("finance.banking.read")
  @ApiOperation({ summary: "Get bank transaction details by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.bankingService.findTransactionById(id);
  }

  @Post()
  @RequirePermission("finance.banking.write")
  @ApiOperation({
    summary:
      "Record a bank transaction (automatically updates bank balance and optional GL double-entry)",
  })
  create(@Body() dto: CreateBankTransactionDto) {
    return this.bankingService.recordTransaction(dto);
  }

  @Post(":id/reconcile")
  @RequirePermission("finance.banking.write")
  @ApiOperation({ summary: "Mark a bank transaction as reconciled" })
  reconcile(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReconcileTransactionDto,
  ) {
    return this.bankingService.reconcileTransaction(id, dto);
  }

  @Post(":id/unreconcile")
  @RequirePermission("finance.banking.write")
  @ApiOperation({ summary: "Unmark a bank transaction as reconciled" })
  unreconcile(@Param("id", ParseIntPipe) id: number) {
    return this.bankingService.unreconcileTransaction(id);
  }
}
