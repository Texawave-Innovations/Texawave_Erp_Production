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
  DecideExpenseClaimDto,
  QueryExpenseClaimDto,
} from "./dto/expense-claim.dto.js";
import { ExpenseClaimsService } from "./expense-claims.service.js";

/** HR surface. Reads are own/team/all. Deciding needs `hr.expense_claim.decide`
 * at team or all scope. Claims are final once decided: no edit, cancel or
 * resubmit (none in legacy). */
@ApiTags("hr-expense-claims")
@Controller("hr/expense-claims")
export class ExpenseClaimsController {
  constructor(private readonly claims: ExpenseClaimsService) {}

  @Get()
  @RequireScopedPermission("hr.expense_claim.read")
  @ApiOperation({ summary: "Expense claims in the caller's scope" })
  findAll(@Paginate(QueryExpenseClaimDto) query: QueryExpenseClaimDto) {
    return this.claims.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.expense_claim.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.claims.findOne(id);
  }

  @Post(":id/decision")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.expense_claim.decide")
  @ApiOperation({ summary: "Approve or reject a PENDING claim (final)" })
  decide(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DecideExpenseClaimDto,
  ) {
    return this.claims.decide(id, dto);
  }
}
