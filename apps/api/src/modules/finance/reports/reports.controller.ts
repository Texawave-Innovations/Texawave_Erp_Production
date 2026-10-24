import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { QueryBalanceSheetDto } from "./dto/query-balance-sheet.dto.js";
import { QueryCashBankSummaryDto } from "./dto/query-cash-bank-summary.dto.js";
import { QueryGeneralLedgerDto } from "./dto/query-general-ledger.dto.js";
import { QueryPeriodClosingDto } from "./dto/query-period-closing.dto.js";
import { QueryProfitAndLossDto } from "./dto/query-profit-and-loss.dto.js";
import { QueryTrialBalanceDto } from "./dto/query-trial-balance.dto.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("finance-reports")
@Controller("finance/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("profit-and-loss")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Profit & Loss statement (Revenue, Expenses, Net Income) derived from posted journal lines",
  })
  getProfitAndLoss(@Query() query: QueryProfitAndLossDto) {
    return this.reportsService.getProfitAndLoss(query);
  }

  @Get("balance-sheet")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Balance Sheet snapshot (Assets, Liabilities, Equity) verifying Assets = Liabilities + Equity",
  })
  getBalanceSheet(@Query() query: QueryBalanceSheetDto) {
    return this.reportsService.getBalanceSheet(query);
  }

  @Get("trial-balance")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Trial Balance summarizing opening, period, and closing balances for all Chart of Accounts records",
  })
  getTrialBalance(@Query() query: QueryTrialBalanceDto) {
    return this.reportsService.getTrialBalance(query);
  }

  @Get("general-ledger")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Account-level General Ledger statement with chronologically ordered posted transactions and running balance",
  })
  getGeneralLedger(
    @Paginate(QueryGeneralLedgerDto) query: QueryGeneralLedgerDto,
  ) {
    return this.reportsService.getGeneralLedger(query);
  }

  @Get("cash-bank-summary")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Cash and Bank balances, period inflows, outflows, and closing balances across all treasury accounts",
  })
  getCashBankSummary(@Query() query: QueryCashBankSummaryDto) {
    return this.reportsService.getCashBankSummary(query);
  }

  @Get("period-closing-status")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Financial Period Closing status audit (draft entry validation, debit/credit balancing, unreconciled items)",
  })
  getPeriodClosingStatus(@Query() query: QueryPeriodClosingDto) {
    return this.reportsService.getPeriodClosingStatus(query);
  }
}
