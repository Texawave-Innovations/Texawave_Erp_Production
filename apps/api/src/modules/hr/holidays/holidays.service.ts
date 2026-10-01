import { BadRequestException, Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateHolidayDto,
  QueryHolidayDto,
  UpdateHolidayDto,
} from "./dto/holiday.dto.js";
import { HolidaysRepository } from "./holidays.repository.js";

@Injectable()
export class HolidaysService {
  constructor(
    private readonly repository: HolidaysRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryHolidayDto) {
    if (
      query.from &&
      query.to &&
      parseDateOnly(query.from) > parseDateOnly(query.to)
    ) {
      throw new BadRequestException("`from` must not be after `to`");
    }
    if (query.year !== undefined && (query.from || query.to)) {
      throw new BadRequestException(
        "Use either `year` or `from`/`to`, not both",
      );
    }
    if (query.organizationWide && query.workLocationId !== undefined) {
      throw new BadRequestException(
        "`organizationWide` and `workLocationId` are mutually exclusive",
      );
    }
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        year: query.year,
        from: query.from,
        to: query.to,
        workLocationId: query.workLocationId,
        organizationWide: query.organizationWide,
        isActive: query.isActive,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Holiday", id);
    return row;
  }

  create(dto: CreateHolidayDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateHolidayDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Holiday", id);
    return row;
  }

  async setActive(id: number, isActive: boolean) {
    const row = await this.repository.setActive(
      this.tenantContext.getOrgScope(),
      id,
      isActive,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Holiday", id);
    return row;
  }
}
