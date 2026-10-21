import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateExchangeRateDto } from "./dto/create-exchange-rate.dto.js";

export interface ExchangeRateFilter {
  fromCurrency?: string | undefined;
  toCurrency?: string | undefined;
  effectiveDate?: string | undefined;
}

@Injectable()
export class ExchangeRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: ExchangeRateFilter,
    pagination: PaginationDto,
  ) {
    const where: Prisma.ExchangeRateWhereInput = {
      organizationId: scope.organizationId,
      ...(filter.fromCurrency ? { fromCurrency: filter.fromCurrency } : {}),
      ...(filter.toCurrency ? { toCurrency: filter.toCurrency } : {}),
      ...(filter.effectiveDate
        ? { effectiveDate: { lte: new Date(filter.effectiveDate) } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
      }),
      this.prisma.exchangeRate.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findRateOnOrBefore(
    scope: OrgScope,
    fromCurrency: string,
    toCurrency: string,
    date: Date,
  ) {
    return this.prisma.exchangeRate.findFirst({
      where: {
        organizationId: scope.organizationId,
        fromCurrency,
        toCurrency,
        effectiveDate: { lte: date },
      },
      orderBy: { effectiveDate: "desc" },
    });
  }

  @OrgScoped()
  async upsert(scope: OrgScope, dto: CreateExchangeRateDto, createdBy: number) {
    const dateObj = new Date(dto.effectiveDate);
    const rateDecimal = new Prisma.Decimal(dto.rate);

    return this.prisma.exchangeRate.upsert({
      where: {
        organizationId_fromCurrency_toCurrency_effectiveDate: {
          organizationId: scope.organizationId,
          fromCurrency: dto.fromCurrency,
          toCurrency: dto.toCurrency,
          effectiveDate: dateObj,
        },
      },
      update: {
        rate: rateDecimal,
        source: dto.source ?? "manual",
      },
      create: {
        organizationId: scope.organizationId,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rate: rateDecimal,
        effectiveDate: dateObj,
        source: dto.source ?? "manual",
        createdBy,
      },
    });
  }
}
