import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CreateExpenseDto } from "./dto/create-expense.dto.js";
import { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import { ExpensesService } from "./expenses.service.js";

@ApiTags("Project Expenses")
@ApiBearerAuth()
@Controller("projects")
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get("expenses")
  @RequirePermission("projects.expenses.read")
  @ApiOperation({
    summary: "List all project expenses across the organization",
  })
  findAllExpenses() {
    return this.service.findExpenses();
  }

  @Get(":id/expenses")
  @RequirePermission("projects.expenses.read")
  @ApiOperation({ summary: "List expenses for a specific project" })
  findProjectExpenses(@Param("id", ParseIntPipe) projectId: number) {
    return this.service.findExpenses(projectId);
  }

  @Get("expenses/:expenseId")
  @RequirePermission("projects.expenses.read")
  @ApiOperation({ summary: "Get project expense by ID" })
  findExpenseById(@Param("expenseId", ParseIntPipe) expenseId: number) {
    return this.service.findExpenseById(expenseId);
  }

  @Post(":id/expenses")
  @RequirePermission("projects.expenses.write")
  @ApiOperation({
    summary: "Create an expense under a project and update actualCost",
  })
  createExpense(
    @Param("id", ParseIntPipe) projectId: number,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.service.createExpense(projectId, dto);
  }

  @Patch("expenses/:expenseId")
  @RequirePermission("projects.expenses.write")
  @ApiOperation({ summary: "Update project expense details or payment status" })
  updateExpense(
    @Param("expenseId", ParseIntPipe) expenseId: number,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.service.updateExpense(expenseId, dto);
  }
}
