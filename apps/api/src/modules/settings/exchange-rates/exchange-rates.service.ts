import { Injectable } from "@nestjs/common";
import {
  getCurrencyDecimals,
  STANDARD_BASE_EXCHANGE_RATES,
} from "../common/formatting-utils.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { OrganizationSettingsRepository } from "../organization/organization-settings.repository.js";
import type { ConvertCurrencyDto } from "./dto/convert-currency.dto.js";
import type { CreateExchangeRateDto } from "./dto/create-exchange-rate.dto.js";
import type { QueryExchangeRatesDto } from "./dto/query-exchange-rates.dto.js";
import { ExchangeRatesRepository } from "./exchange-rates.repository.js";

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface CurrencyConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  convertedAmount: number;
  effectiveDate: string;
  method: "identity" | "direct" | "inverse" | "triangulation";
  viaCurrency?: string;
  source?: string;
}

@Injectable()
export class ExchangeRatesService {
  constructor(
    private readonly repository: ExchangeRatesRepository,
    private readonly orgSettingsRepo: OrganizationSettingsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryExchangeRatesDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      {
        fromCurrency: query.fromCurrency,
        toCurrency: query.toCurrency,
        effectiveDate: query.effectiveDate,
      },
      query,
    );

    const serializedItems = items.map((item) => ({
      ...item,
      rate: Number(item.rate),
      effectiveDate: item.effectiveDate.toISOString().slice(0, 10),
    }));

    return new PaginatedResponseDto(
      serializedItems,
      total,
      query.page,
      query.limit,
    );
  }

  async upsertRate(dto: CreateExchangeRateDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    if (dto.fromCurrency === dto.toCurrency) {
      throw new BusinessRuleViolationException(
        "Source and target currencies cannot be the same for an exchange rate entry.",
        "INVALID_CURRENCY_PAIR",
      );
    }

    if (dto.rate <= 0) {
      throw new BusinessRuleViolationException(
        "Exchange rate must be greater than zero.",
        "INVALID_EXCHANGE_RATE",
      );
    }

    const saved = await this.repository.upsert(scope, dto, userId);

    return {
      ...saved,
      rate: Number(saved.rate),
      effectiveDate: saved.effectiveDate.toISOString().slice(0, 10),
    };
  }

  async convertCurrency(
    dto: ConvertCurrencyDto,
  ): Promise<CurrencyConversionResult> {
    const scope = this.tenantContext.getOrgScope();
    const from = dto.from.toUpperCase();
    const to = dto.to.toUpperCase();
    const date = dto.date ? new Date(dto.date) : new Date();
    const dateStr = date.toISOString().slice(0, 10);
    const targetDecimals = getCurrencyDecimals(to);

    // 1. Identity conversion
    if (from === to) {
      return {
        amount: dto.amount,
        fromCurrency: from,
        toCurrency: to,
        rate: 1.0,
        convertedAmount: roundTo(dto.amount, targetDecimals),
        effectiveDate: dateStr,
        method: "identity",
      };
    }

    // 2. Direct lookup: from -> to
    const direct = await this.repository.findRateOnOrBefore(
      scope,
      from,
      to,
      date,
    );
    if (direct) {
      const rate = Number(direct.rate);
      return {
        amount: dto.amount,
        fromCurrency: from,
        toCurrency: to,
        rate,
        convertedAmount: roundTo(dto.amount * rate, targetDecimals),
        effectiveDate: direct.effectiveDate.toISOString().slice(0, 10),
        method: "direct",
        source: direct.source,
      };
    }

    // 3. Inverse lookup: to -> from
    const inverse = await this.repository.findRateOnOrBefore(
      scope,
      to,
      from,
      date,
    );
    if (inverse) {
      const invRate = Number(inverse.rate);
      if (invRate > 0) {
        const rate = 1 / invRate;
        return {
          amount: dto.amount,
          fromCurrency: from,
          toCurrency: to,
          rate: Number(rate.toFixed(6)),
          convertedAmount: roundTo(dto.amount * rate, targetDecimals),
          effectiveDate: inverse.effectiveDate.toISOString().slice(0, 10),
          method: "inverse",
          source: inverse.source,
        };
      }
    }

    // 4. Triangulation via Organization Base Currency
    const org = await this.orgSettingsRepo.findByOrg(scope);
    const base = (org?.baseCurrency ?? "INR").toUpperCase();

    if (from !== base && to !== base) {
      // Find from -> base (direct or inverse)
      let rateFromBase: number | null = null;
      let dateFromBase: string | null = null;

      const direct1 = await this.repository.findRateOnOrBefore(
        scope,
        from,
        base,
        date,
      );
      if (direct1) {
        rateFromBase = Number(direct1.rate);
        dateFromBase = direct1.effectiveDate.toISOString().slice(0, 10);
      } else {
        const inv1 = await this.repository.findRateOnOrBefore(
          scope,
          base,
          from,
          date,
        );
        if (inv1 && Number(inv1.rate) > 0) {
          rateFromBase = 1 / Number(inv1.rate);
          dateFromBase = inv1.effectiveDate.toISOString().slice(0, 10);
        }
      }

      // Find base -> to (direct or inverse)
      let rateBaseTo: number | null = null;
      let dateBaseTo: string | null = null;

      const direct2 = await this.repository.findRateOnOrBefore(
        scope,
        base,
        to,
        date,
      );
      if (direct2) {
        rateBaseTo = Number(direct2.rate);
        dateBaseTo = direct2.effectiveDate.toISOString().slice(0, 10);
      } else {
        const inv2 = await this.repository.findRateOnOrBefore(
          scope,
          to,
          base,
          date,
        );
        if (inv2 && Number(inv2.rate) > 0) {
          rateBaseTo = 1 / Number(inv2.rate);
          dateBaseTo = inv2.effectiveDate.toISOString().slice(0, 10);
        }
      }

      if (rateFromBase !== null && rateBaseTo !== null) {
        const combinedRate = rateFromBase * rateBaseTo;
        return {
          amount: dto.amount,
          fromCurrency: from,
          toCurrency: to,
          rate: Number(combinedRate.toFixed(6)),
          convertedAmount: roundTo(dto.amount * combinedRate, targetDecimals),
          effectiveDate: dateBaseTo ?? dateFromBase ?? dateStr,
          method: "triangulation",
          viaCurrency: base,
        };
      }
    }

    // 5. Fallback to standard market reference rates for major business currencies
    const fromStd = from === "INR" ? 1.0 : STANDARD_BASE_EXCHANGE_RATES[from];
    const toStd = to === "INR" ? 1.0 : STANDARD_BASE_EXCHANGE_RATES[to];
    if (fromStd && toStd && toStd > 0) {
      const rate = fromStd / toStd;
      return {
        amount: dto.amount,
        fromCurrency: from,
        toCurrency: to,
        rate: Number(rate.toFixed(6)),
        convertedAmount: roundTo(dto.amount * rate, targetDecimals),
        effectiveDate: dateStr,
        method: from === "INR" || to === "INR" ? "direct" : "triangulation",
        source: "standard_reference",
      };
    }

    throw new BusinessRuleViolationException(
      `No exchange rate found to convert ${from} to ${to} on or before ${dateStr}. Please configure the exchange rate under Settings > Regional Formats.`,
      "EXCHANGE_RATE_NOT_FOUND",
    );
  }
}
