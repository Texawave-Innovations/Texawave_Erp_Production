import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
const ZERO = D(0);

/** The single write path for per-bin stock, mirroring `StockPostingService`'s
 * shape for the warehouse (product, warehouse) balance: every call locks the
 * row for the duration of the caller's transaction, so two concurrent
 * put-aways/movements into or out of the same bin never race. Never touches
 * the stock ledger or `ScmStockBalance` — total on-hand per product/
 * warehouse does not change when stock moves between bins inside it. */
@Injectable()
export class LocationStockService {
  /** Adds `delta` (negative to remove) to one bin's balance, creating the
   * row on first use. Rejects a result below zero and, when `capacity` is
   * given, a result that would exceed it. */
  async adjust(
    tx: Prisma.TransactionClient,
    organizationId: number,
    productId: number,
    warehouseId: number,
    locationId: number,
    delta: number,
    capacity?: number | null,
  ) {
    await tx.scmLocationStock.upsert({
      where: {
        productId_warehouseId_locationId: {
          productId,
          warehouseId,
          locationId,
        },
      },
      create: { organizationId, productId, warehouseId, locationId },
      update: {},
    });
    await tx.$queryRaw`SELECT id FROM scm.location_stock WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} AND location_id = ${locationId} FOR UPDATE`;
    const row = await tx.scmLocationStock.findUniqueOrThrow({
      where: {
        productId_warehouseId_locationId: {
          productId,
          warehouseId,
          locationId,
        },
      },
    });
    const next = row.quantity.plus(D(delta));
    if (next.lessThan(0)) {
      throw new BusinessRuleViolationException(
        `Only ${row.quantity.toString()} unit(s) of this product are at that location.`,
        "LOCATION_INSUFFICIENT",
      );
    }
    if (capacity && next.greaterThan(D(capacity))) {
      throw new BusinessRuleViolationException(
        `That location is at capacity (${row.quantity.toString()}/${capacity}) — cannot fit ${delta} more.`,
        "LOCATION_CAPACITY",
      );
    }
    return tx.scmLocationStock.update({
      where: { id: row.id },
      data: { quantity: next },
    });
  }

  /** Current balance for one bin, or zero if nothing has ever moved there. */
  async balance(
    tx: Prisma.TransactionClient,
    productId: number,
    warehouseId: number,
    locationId: number,
  ): Promise<number> {
    const row = await tx.scmLocationStock.findUnique({
      where: {
        productId_warehouseId_locationId: {
          productId,
          warehouseId,
          locationId,
        },
      },
    });
    return row ? Number(row.quantity) : 0;
  }

  /** Total occupancy of one bin across every product (for capacity checks
   * and the Locations/Stock-view pages). */
  async occupancy(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    locationId: number,
  ): Promise<number> {
    const rows = await tx.scmLocationStock.aggregate({
      where: { warehouseId, locationId },
      _sum: { quantity: true },
    });
    return Number(rows._sum.quantity ?? ZERO);
  }
}
