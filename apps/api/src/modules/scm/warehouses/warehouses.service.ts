import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  VALID_PARENT_TYPE,
  type CreateLocationDto,
  type CreateWarehouseDto,
  type QueryLocationDto,
  type QueryWarehouseDto,
  type UpdateLocationDto,
  type UpdateWarehouseDto,
} from "./dto/warehouse.dto.js";
import { WarehousesRepository } from "./warehouses.repository.js";

@Injectable()
export class WarehousesService {
  constructor(
    private readonly repository: WarehousesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryWarehouseDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { q: query.q, status: query.status },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  findOptions() {
    return this.repository.findOptions(this.tenantContext.getOrgScope());
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Warehouse", id);
    return row;
  }

  async create(dto: CreateWarehouseDto) {
    const scope = this.tenantContext.getOrgScope();
    await this.assertCodeFree(dto.code);
    try {
      return await this.repository.create(
        scope,
        dto,
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      throw this.mapUnique(error, `Warehouse code "${dto.code}"`);
    }
  }

  async update(id: number, dto: UpdateWarehouseDto) {
    const scope = this.tenantContext.getOrgScope();
    const current = await this.findOne(id);
    if (dto.code && dto.code.toLowerCase() !== current.code.toLowerCase()) {
      await this.assertCodeFree(dto.code, id);
    }
    if (dto.status === "Inactive" && current.status !== "Inactive") {
      const open = await this.repository.countOpenPurchaseOrders(scope, id);
      if (open > 0) {
        throw new BusinessRuleViolationException(
          "Cannot deactivate — this warehouse has open purchase orders awaiting receipt",
          "WAREHOUSE_HAS_OPEN_POS",
        );
      }
    }
    try {
      const row = await this.repository.update(
        scope,
        id,
        dto,
        this.tenantContext.getUserId(),
      );
      if (!row) throw new ResourceNotFoundException("Warehouse", id);
      return row;
    } catch (error) {
      throw this.mapUnique(error, `Warehouse code "${dto.code ?? ""}"`);
    }
  }

  // ---- locations ----------------------------------------------------------

  async findLocations(query: QueryLocationDto) {
    const { items, total } = await this.repository.findLocations(
      this.tenantContext.getOrgScope(),
      { warehouseId: query.warehouseId, locationType: query.locationType },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  findLocationOptions(warehouseId?: number) {
    return this.repository.findLocationOptions(
      this.tenantContext.getOrgScope(),
      warehouseId,
    );
  }

  async findLocation(id: number) {
    const row = await this.repository.findLocation(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Location", id);
    return row;
  }

  /** Legacy rules: a RACK sits in a ZONE, a SHELF in a RACK, a BIN in a
   * SHELF; the full code is `WH-ZONE-RACK-SHELF-BIN` and is unique within the
   * warehouse. zone/rack/shelf are derived from the ancestor chain. */
  async createLocation(dto: CreateLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    const warehouse = await this.findOne(dto.warehouseId);
    const requiredParent = VALID_PARENT_TYPE[dto.locationType];
    let parent = null;
    if (requiredParent) {
      if (!dto.parentLocationId) {
        throw new BusinessRuleViolationException(
          `A ${dto.locationType.toLowerCase()} must be placed inside a ${requiredParent.toLowerCase()}`,
          "LOCATION_PARENT_REQUIRED",
        );
      }
      parent = await this.repository.findLocation(scope, dto.parentLocationId);
      if (
        !parent ||
        parent.warehouseId !== warehouse.id ||
        (parent.locationType ?? "BIN") !== requiredParent
      ) {
        throw new BusinessRuleViolationException(
          `Invalid parent — a ${dto.locationType.toLowerCase()} must be placed inside a ${requiredParent.toLowerCase()} of the same warehouse`,
          "LOCATION_PARENT_INVALID",
        );
      }
    } else if (dto.parentLocationId) {
      throw new BusinessRuleViolationException(
        "A zone sits directly in the warehouse and cannot have a parent location",
        "LOCATION_PARENT_INVALID",
      );
    }
    const ancestors = await this.repository.ancestorsOf(
      scope,
      parent?.id ?? null,
    );
    const code = dto.code;
    const locationCode = [
      warehouse.code,
      ...ancestors.map((a) => a.binCode),
      code,
    ]
      .join("-")
      .toUpperCase();
    const typed = (t: string) =>
      dto.locationType === t
        ? code
        : (ancestors.find((a) => a.locationType === t)?.binCode ?? null);
    try {
      return await this.repository.createLocation(
        scope,
        {
          warehouseId: warehouse.id,
          parentLocationId: parent?.id ?? null,
          locationType: dto.locationType,
          locationCode,
          zone: typed("ZONE"),
          rack: typed("RACK"),
          shelf: typed("SHELF"),
          binCode: code,
          locationName: dto.locationName?.trim() || null,
          capacity: dto.capacity ?? null,
          capacityUnit: dto.capacity ? (dto.capacityUnit ?? "UNITS") : null,
          notes: dto.notes?.trim() || null,
        },
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      throw this.mapUnique(
        error,
        `Location code "${locationCode}" already exists in this warehouse —`,
      );
    }
  }

  async updateLocation(id: number, dto: UpdateLocationDto) {
    const row = await this.repository.updateLocation(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Location", id);
    return row;
  }

  private async assertCodeFree(code: string, exceptId?: number) {
    const clash = await this.repository.findByCode(
      this.tenantContext.getOrgScope(),
      code,
    );
    if (clash && clash.id !== exceptId) {
      throw new ResourceConflictException(
        `Warehouse code "${code}" is already used by ${clash.name}`,
      );
    }
  }

  private mapUnique(error: unknown, subject: string) {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(`${subject} is already in use.`)
      : error;
  }
}
