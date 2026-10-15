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
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { DeliveryChallansService } from "./delivery-challans.service.js";
import {
  CreateDeliveryChallanDto,
  QueryDeliveryChallanDto,
  UpdateDeliveryChallanDto,
} from "./dto/delivery-challan.dto.js";
import {
  NextNumberQueryDto,
  SendDocumentEmailDto,
} from "./dto/document-parts.dto.js";

const READ = "sales.delivery_challan.read";
const WRITE = "sales.delivery_challan.write";
const DELETE = "sales.delivery_challan.delete";
const SEND = "sales.delivery_challan.send";

@ApiTags("sales-delivery-challans")
@Controller("sales/delivery-challans")
export class DeliveryChallansController {
  constructor(private readonly challans: DeliveryChallansService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Delivery challans (search, customer, dates)" })
  findAll(@Paginate(QueryDeliveryChallanDto) query: QueryDeliveryChallanDto) {
    return this.challans.findAll(query);
  }

  // Declared before ":id" so "next-number" is not parsed as an id.
  @Get("next-number")
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Preview the next DC number (not reserved)" })
  nextNumber(@Query() query: NextNumberQueryDto) {
    return this.challans.nextNumber(query.date);
  }

  @Get(":id")
  @RequirePermission(READ)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.challans.findOne(id);
  }

  @Get(":id/pdf")
  @RequirePermission(READ)
  @RawResponse()
  @ApiOperation({ summary: "Download the delivery challan as PDF" })
  async pdf(@Param("id", ParseIntPipe) id: number) {
    const file = await this.challans.pdf(id);
    return new StreamableFile(file.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Post()
  @RequirePermission(WRITE)
  @ApiOperation({ summary: "Create a delivery challan (no prices)" })
  create(@Body() dto: CreateDeliveryChallanDto) {
    return this.challans.create(dto);
  }

  @Patch(":id")
  @RequirePermission(WRITE)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryChallanDto,
  ) {
    return this.challans.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.challans.remove(id);
  }

  @Post(":id/email")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Email the delivery challan PDF (audited)" })
  email(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendDocumentEmailDto,
  ) {
    return this.challans.email(id, dto);
  }

  @Post(":id/whatsapp")
  @RequirePermission(SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "A wa.me share link for the DC (audited)" })
  whatsapp(@Param("id", ParseIntPipe) id: number) {
    return this.challans.whatsapp(id);
  }
}
