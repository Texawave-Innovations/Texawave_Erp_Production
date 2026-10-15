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
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CustomersService } from "./customers.service.js";
import {
  CreateCustomerDto,
  NextCustomerCodeQueryDto,
  QueryCustomerDto,
  UpdateCustomerDto,
} from "./dto/customer.dto.js";

const READ = "sales.customer.read";
const WRITE = "sales.customer.write";
const DELETE = "sales.customer.delete";
const REVEAL_BANK = "sales.customer_bank.reveal";

@ApiTags("sales-customers")
@Controller("sales/customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Customers directory (search, paginate)" })
  findAll(@Paginate(QueryCustomerDto) query: QueryCustomerDto) {
    return this.customers.findAll(query);
  }

  // Declared before ":id" so "next-code" is not parsed as an id.
  @Get("next-code")
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Preview the next customer code (not reserved)",
  })
  nextCode(@Query() query: NextCustomerCodeQueryDto) {
    return this.customers.nextCode(query.mobileCountryCode);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.customers.findOne(id);
  }

  @Get(":id/bank-account")
  @RequirePermission(REVEAL_BANK)
  @ApiOperation({ summary: "Reveal the full bank account number (audited)" })
  revealBankAccount(@Param("id", ParseIntPipe) id: number) {
    return this.customers.revealBankAccount(id);
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Create a customer; the code is issued by the server",
  })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.customers.remove(id);
  }
}
