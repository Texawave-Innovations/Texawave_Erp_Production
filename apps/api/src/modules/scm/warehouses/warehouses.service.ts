import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { MasterListValueGuard } from "../master-list-items/master-list-value.guard.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  ALLOWED_PARENT_TYPES,
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
    private readonly masterListGuard: MasterListValueGuard,
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
    await this.masterListGuard.assertValid(
      scope,
      "warehouse_type",
      dto.type,
      "Warehouse type",
    );
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
    await this.masterListGuard.assertValid(
      scope,
      "warehouse_type",
      dto.type,
      "Warehouse type",
    );
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

  /** Parent rules: a zone has none, a rack may sit in a zone (optional), a
   * shelf must be inside a rack, a bin may sit in a rack (or a legacy
   * shelf). The full code is `WH-<ancestors...>-CODE`, unique per warehouse;
   * zone/rack/shelf are derived from the ancestor chain. A rack can create its
   * bins (B01, B02, ...) in the same transaction. */
  async createLocation(dto: CreateLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    let warehouse = await this.findOne(dto.warehouseId);
    let parent = null;
    if (dto.parentLocationId) {
      parent = await this.repository.findLocation(scope, dto.parentLocationId);
      if (!parent)
        throw new ResourceNotFoundException("Location", dto.parentLocationId);
      if (parent.warehouseId !== warehouse.id) {
        // A child always lives in its parent's warehouse.
        warehouse = await this.findOne(parent.warehouseId);
      }
    }
    this.assertParent(dto.locationType, parent);
    if (dto.bins?.length && dto.locationType !== "RACK") {
      throw new BusinessRuleViolationException(
        "Only a rack can create bins together with it",
        "LOCATION_BINS_ON_NON_RACK",
      );
    }
    const ancestors = await this.repository.ancestorsOf(
      scope,
      parent?.id ?? null,
    );
    const code = dto.code;
    const chain = [
      ...ancestors,
      ...(parent && !ancestors.some((a) => a.id === parent.id) ? [parent] : []),
    ];
    const locationCode = this.codeOf(warehouse.code, chain, code);
    const rackName = dto.locationName?.trim() || code;
    const typed = (t: string, own: string | null) =>
      dto.locationType === t
        ? code
        : (chain.find((a) => a.locationType === t)?.binCode ?? own);
    const zone = typed("ZONE", null);
    const rack = typed("RACK", null);
    const shelf = typed("SHELF", null);

    const bins = (dto.bins ?? []).map((b, i, all) => {
      const pad = Math.max(2, String(all.length).length);
      const binCode = `B${String(i + 1).padStart(pad, "0")}`;
      return {
        warehouseId: warehouse.id,
        locationType: "BIN",
        locationCode: this.codeOf(
          warehouse.code,
          [...chain, { binCode: code }],
          binCode,
        ),
        zone,
        rack,
        shelf: null,
        binCode,
        locationName: b.name?.trim() || `${rackName}${i + 1}`,
        capacity: b.capacity ?? null,
        capacityUnit: b.capacity ? (b.capacityUnit ?? "UNITS") : null,
        notes: null,
      };
    });
    try {
      const { location } = await this.repository.createLocationTree(
        scope,
        {
          warehouseId: warehouse.id,
          parentLocationId: parent?.id ?? null,
          locationType: dto.locationType,
          locationCode,
          zone,
          rack,
          shelf,
          binCode: code,
          locationName: dto.locationName?.trim() || null,
          capacity: dto.capacity ?? null,
          capacityUnit: dto.capacity ? (dto.capacityUnit ?? "UNITS") : null,
          notes: dto.notes?.trim() || null,
        },
        bins,
        this.tenantContext.getUserId(),
      );
      return location;
    } catch (error) {
      throw this.mapUnique(
        error,
        `Location code "${locationCode}" already exists in this warehouse —`,
      );
    }
  }

  private codeOf(
    warehouseCode: string,
    chain: { binCode: string }[],
    code: string,
  ) {
    return [warehouseCode, ...chain.map((a) => a.binCode), code]
      .join("-")
      .toUpperCase();
  }

  private assertParent(
    type: string,
    parent: { locationType: string | null } | null,
  ) {
    const allowed =
      ALLOWED_PARENT_TYPES[type as keyof typeof ALLOWED_PARENT_TYPES] ?? [];
    if (type === "SHELF" && !parent) {
      throw new BusinessRuleViolationException(
        "A shelf must be placed inside a rack",
        "LOCATION_PARENT_REQUIRED",
      );
    }
    if (parent && !allowed.includes((parent.locationType ?? "BIN") as never)) {
      throw new BusinessRuleViolationException(
        allowed.length === 0
          ? `A ${type.toLowerCase()} sits directly in the warehouse and cannot have a parent location`
          : `Invalid parent — a ${type.toLowerCase()} must be placed inside a ${allowed.map((a) => a.toLowerCase()).join(" or ")}`,
        "LOCATION_PARENT_INVALID",
      );
    }
  }

  /** Plain edits (name/capacity/notes/status) or a structural edit —
   * warehouse, type, parent or code — which re-derives the warehouse, code and
   * zone/rack/shelf of this location and everything nested under it. */
  async updateLocation(id: number, dto: UpdateLocationDto) {
    const scope = this.tenantContext.getOrgScope();
    const actor = this.tenantContext.getUserId();
    const structural =
      dto.warehouseId !== undefined ||
      dto.locationType !== undefined ||
      dto.parentLocationId !== undefined ||
      dto.code !== undefined;
    if (!structural) {
      const row = await this.repository.updateLocation(scope, id, dto, actor);
      if (!row) throw new ResourceNotFoundException("Location", id);
      return row;
    }

    const all = await this.repository.findLocationOptions(scope);
    const byId = new Map(all.map((l) => [l.id, l]));
    const current = byId.get(id);
    if (!current) throw new ResourceNotFoundException("Location", id);
    const newType = dto.locationType ?? current.locationType ?? "BIN";
    const newParentId =
      dto.parentLocationId === undefined
        ? current.parentLocationId
        : dto.parentLocationId;
    const newParent = newParentId ? byId.get(newParentId) : undefined;
    if (newParentId && !newParent)
      throw new ResourceNotFoundException("Location", newParentId);
    this.assertParent(newType, newParent ?? null);
    const newWarehouseId =
      newParent?.warehouseId ?? dto.warehouseId ?? current.warehouseId;
    const warehouse = await this.findOne(newWarehouseId);
    const newCode = dto.code ?? current.binCode;

    // This location plus everything nested under it, parents first.
    const subtree: typeof all = [];
    const seen = new Set<number>();
    const walk = (lid: number) => {
      if (seen.has(lid)) return;
      seen.add(lid);
      const node = byId.get(lid);
      if (node) subtree.push(node);
      all.filter((l) => l.parentLocationId === lid).forEach((c) => walk(c.id));
    };
    walk(id);
    if (newParent && seen.has(newParent.id)) {
      throw new BusinessRuleViolationException(
        "A location cannot be placed inside itself or one of its own children",
        "LOCATION_PARENT_CYCLE",
      );
    }

    const updated = new Map<number, (typeof all)[number]>();
    const resolve = (l: (typeof all)[number]) => updated.get(l.id) ?? l;
    const chainOf = (l: (typeof all)[number]) => {
      const chain: typeof all = [];
      let pid = l.parentLocationId;
      const guard = new Set<number>();
      while (pid && !guard.has(pid)) {
        guard.add(pid);
        const par = byId.get(pid);
        if (!par) break;
        chain.unshift(resolve(par));
        pid = par.parentLocationId;
      }
      return chain;
    };
    const root = {
      ...current,
      warehouseId: newWarehouseId,
      parentLocationId: newParentId ?? null,
      locationType: newType,
      binCode: newCode,
    };
    updated.set(id, root);
    const patches: { id: number; data: Record<string, unknown> }[] = [];
    for (const loc of subtree) {
      const node =
        loc.id === id ? root : { ...loc, warehouseId: newWarehouseId };
      const chain = chainOf(node);
      const full = [...chain, node];
      const find = (t: string) =>
        full.find((x) => x.locationType === t)?.binCode ?? null;
      const patch = {
        warehouseId: newWarehouseId,
        parentLocationId: node.parentLocationId,
        locationType: node.locationType,
        binCode: node.binCode,
        locationCode: this.codeOf(warehouse.code, chain, node.binCode),
        zone: find("ZONE"),
        rack: find("RACK"),
        shelf: find("SHELF"),
      };
      updated.set(loc.id, { ...node, ...patch });
      patches.push({
        id: loc.id,
        data:
          loc.id === id
            ? {
                ...patch,
                ...(dto.locationName !== undefined
                  ? { locationName: dto.locationName.trim() || null }
                  : {}),
                ...(dto.capacity !== undefined
                  ? { capacity: dto.capacity }
                  : {}),
                ...(dto.capacityUnit !== undefined
                  ? { capacityUnit: dto.capacityUnit.trim() || null }
                  : {}),
                ...(dto.notes !== undefined
                  ? { notes: dto.notes.trim() || null }
                  : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
              }
            : patch,
      });
    }
    const rootCode = patches[0]!.data.locationCode as string;
    const subtreeIds = new Set(subtree.map((l) => l.id));
    if (
      all.some(
        (l) =>
          !subtreeIds.has(l.id) &&
          l.warehouseId === newWarehouseId &&
          (l.locationCode ?? "").toUpperCase() === rootCode,
      )
    ) {
      throw new ResourceConflictException(
        `Location code "${rootCode}" already exists in this warehouse`,
      );
    }
    try {
      return await this.repository.applyLocationPatches(
        scope,
        patches,
        id,
        actor,
      );
    } catch (error) {
      throw this.mapUnique(error, `Location code "${rootCode}"`);
    }
  }

  locationStock(warehouseId?: number) {
    return this.repository.locationStockSummary(
      this.tenantContext.getOrgScope(),
      warehouseId,
    );
  }

  async removeLocation(id: number, force: boolean) {
    const result = await this.repository.removeLocationTree(
      this.tenantContext.getOrgScope(),
      id,
      force,
      this.tenantContext.getUserId(),
    );
    if (!result) throw new ResourceNotFoundException("Location", id);
    return result;
  }

  async removeWarehouse(id: number) {
    const ok = await this.repository.removeWarehouse(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!ok) throw new ResourceNotFoundException("Warehouse", id);
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
