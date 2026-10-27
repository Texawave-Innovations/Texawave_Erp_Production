import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CustomersService } from "./customers.service.js";
import {
  CreateCustomerDto,
  CreateSalesOrderDto,
  IssueSalesInvoiceDto,
  QueryCustomerDto,
  QuerySalesOrderDto,
  UpdateCustomerDto,
} from "./dto/sales.dto.js";
import { SalesOrdersService } from "./sales-orders.service.js";

/** SCM-owned customer master (the new ERP has no Sales module yet). */
@ApiTags("scm-customers")
@Controller("scm/customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission("scm.sales.read")
  findAll(@Paginate(QueryCustomerDto) query: QueryCustomerDto) {
    return this.customers.findAll(query);
  }

  @Get("options")
  @RequirePermission("scm.sales.read")
  options() {
    return this.customers.findOptions();
  }

  @Get(":id")
  @RequirePermission("scm.sales.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.customers.findOne(id);
  }

  @Post()
  @RequirePermission("scm.sales.write")
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.sales.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }
}

/** Minimal SCM sales orders — the demand that fulfillment works from. */
@ApiTags("scm-sales-orders")
@Controller("scm/sales-orders")
export class SalesOrdersController {
  constructor(private readonly orders: SalesOrdersService) {}

  @Get()
  @RequirePermission("scm.sales.read")
  findAll(@Paginate(QuerySalesOrderDto) query: QuerySalesOrderDto) {
    return this.orders.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.sales.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.orders.findOne(id);
  }

  @Post()
  @RequirePermission("scm.sales.write")
  create(@Body() dto: CreateSalesOrderDto) {
    return this.orders.create(dto);
  }

  @Post(":id/confirm")
  @RequirePermission("scm.sales.write")
  confirm(@Param("id", ParseIntPipe) id: number) {
    return this.orders.confirm(id);
  }

  @Post(":id/issue-invoice")
  @RequirePermission("scm.sales.write")
  issueInvoice(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: IssueSalesInvoiceDto,
  ) {
    return this.orders.issueInvoice(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.sales.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.orders.cancel(id);
  }
}
