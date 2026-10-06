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
import {
  CreateExpenseClaimDto,
  QueryMyExpenseClaimDto,
} from "../../hr/expense-claims/dto/expense-claim.dto.js";
import { ExpenseClaimsService } from "../../hr/expense-claims/expense-claims.service.js";

/** The authenticated user's OWN expense claims. No employee id in any request:
 * "who am I" is resolved from the JWT (employee↔user mapping). */
@ApiTags("employee-self-service")
@Controller("self-service/expense-claims")
export class MyExpenseClaimsController {
  constructor(private readonly claims: ExpenseClaimsService) {}

  @Get()
  @RequirePermission("employee_self_service.expense_claim.read")
  @ApiOperation({ summary: "My expense claims" })
  findMine(@Paginate(QueryMyExpenseClaimDto) query: QueryMyExpenseClaimDto) {
    return this.claims.findMine(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.expense_claim.read")
  @ApiOperation({ summary: "One of my expense claims" })
  findMineOne(@Param("id", ParseIntPipe) id: number) {
    return this.claims.findMineOne(id);
  }

  @Post()
  @RequirePermission("employee_self_service.expense_claim.create")
  @ApiOperation({
    summary: "Submit an expense claim for myself (starts PENDING)",
  })
  create(@Body() dto: CreateExpenseClaimDto) {
    return this.claims.createForCurrentEmployee(dto);
  }
}
