import { BadRequestException, Injectable } from "@nestjs/common";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { MasterListItemsRepository } from "./master-list-items.repository.js";
import type { ScmMasterListCategory } from "./scm-master-list-items.constants.js";

/** Validates that a value submitted on another SCM form (Supplier.type,
 * ScmWarehouse.type, ScmPackingPackage.packageType,
 * ScmStockAdjustment.reason) is one of the org's active SCM Master values
 * for that category — replaces a static `@IsIn()` list, since the masterlist
 * admin screen (Settings → Masters → SCM Master) is now the source of truth
 * for these 4 categories and its values are per-organization, not fixed in
 * code. */
@Injectable()
export class MasterListValueGuard {
  constructor(private readonly items: MasterListItemsRepository) {}

  async assertValid(
    scope: OrgScope,
    category: ScmMasterListCategory,
    value: string | undefined,
    fieldLabel: string,
  ): Promise<void> {
    if (value === undefined || value === "") return;
    const known = await this.items.activeValues(scope, category);
    if (!known.has(value)) {
      throw new BadRequestException(
        `${fieldLabel} "${value}" is not a known SCM Master value. Add it under Settings → Masters → SCM Master first.`,
      );
    }
  }
}
