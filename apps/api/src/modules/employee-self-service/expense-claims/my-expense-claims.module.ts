import { Module } from "@nestjs/common";
import { ExpenseClaimsModule } from "../../hr/expense-claims/expense-claims.module.js";
import { MyExpenseClaimsController } from "./my-expense-claims.controller.js";

@Module({
  imports: [ExpenseClaimsModule],
  controllers: [MyExpenseClaimsController],
})
export class MyExpenseClaimsModule {}
