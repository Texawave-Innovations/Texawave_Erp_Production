import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ConvertCurrencyDto } from "./dto/convert-currency.dto.js";
import { CreateExchangeRateDto } from "./dto/create-exchange-rate.dto.js";
import { QueryExchangeRatesDto } from "./dto/query-exchange-rates.dto.js";
import { ExchangeRatesService } from "./exchange-rates.service.js";

@ApiTags("settings-exchange-rates")
@Controller("settings/exchange-rates")
export class ExchangeRatesController {
  constructor(private readonly service: ExchangeRatesService) {}

  @Get()
  @RequirePermission("settings.general.read")
  @ApiOperation({ summary: "List exchange rates for the current organization" })
  findAll(@Paginate(QueryExchangeRatesDto) query: QueryExchangeRatesDto) {
    return this.service.findAll(query);
  }

  @Post()
  @RequirePermission("settings.general.update")
  @ApiOperation({ summary: "Create or update an exchange rate entry" })
  upsertRate(@Body() dto: CreateExchangeRateDto) {
    return this.service.upsertRate(dto);
  }

  @Get("convert")
  @RequirePermission("settings.general.read")
  @ApiOperation({
    summary:
      "Convert a monetary amount between currencies using effective rate, inverse or triangulation",
  })
  convertCurrency(@Query() dto: ConvertCurrencyDto) {
    return this.service.convertCurrency(dto);
  }
}
