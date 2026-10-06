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
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import {
  RequirePermission,
  RequireScopedPermission,
} from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreateLoanDto,
  CreateLoanSkipRequestDto,
  DecideLoanSkipRequestDto,
  QueryLoanDto,
} from "./dto/loan.dto.js";
import { LoansService } from "./loans.service.js";

@ApiTags("hr-loans")
@Controller("hr/loans")
export class LoansController {
  constructor(private readonly service: LoansService) {}

  @Post()
  @RequireScopedPermission("hr.loan.write")
  @ApiOperation({ summary: "Disburse / record a new employee loan" })
  create(@Body() dto: CreateLoanDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireScopedPermission("hr.loan.read")
  @ApiOperation({ summary: "List loans with filtering and pagination" })
  findAll(@Paginate(QueryLoanDto) query: QueryLoanDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.loan.read")
  @ApiOperation({
    summary: "Get loan details with repayments and skip requests",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(":id/skip-request")
  @RequireScopedPermission("hr.loan.write")
  @ApiOperation({ summary: "Request an EMI skip for a payroll period" })
  requestSkip(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateLoanSkipRequestDto,
  ) {
    return this.service.requestSkip(id, dto);
  }

  @Post("skip-requests/:id/decide")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.loan.approve")
  @ApiOperation({ summary: "Approve or reject a loan skip request" })
  decideSkip(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DecideLoanSkipRequestDto,
  ) {
    return this.service.decideSkip(id, dto);
  }
}

@ApiTags("employee-self-service-loans")
@Controller("self-service/loans")
export class MyLoansController {
  constructor(private readonly service: LoansService) {}

  @Get()
  @RequirePermission("employee_self_service.loan.read")
  @ApiOperation({ summary: "View my own active and past loans" })
  findMyLoans(@Paginate(QueryLoanDto) query: QueryLoanDto) {
    return this.service.findMyLoans(query);
  }

  @Get(":id")
  @RequirePermission("employee_self_service.loan.read")
  @ApiOperation({ summary: "View my own loan by ID" })
  findMyLoanById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findMyLoanById(id);
  }
}
