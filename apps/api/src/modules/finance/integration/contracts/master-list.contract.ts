import type { OrgScope } from "../../../../common/tenancy/org-scope.js";

/**
 * Details of an HSN (Goods) or SAC (Services) master item.
 */
export interface HsnMasterDetails {
  hsnSacCode: string;
  type: "HSN" | "SAC";
  description: string;
  defaultTaxRate: number; // e.g. 18.0
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  uom?: string | null; // e.g. "PCS", "KG", "MTR"
  isActive: boolean;
}

/**
 * Contract interface for pulling Master List / Product Catalog data into GST.
 * Future Master Data branches can implement this interface to provide centralized statutory catalogs.
 */
export interface IMasterListSource {
  lookupHsnSac(scope: OrgScope, code: string): Promise<HsnMasterDetails | null>;

  getHsnDirectory(scope: OrgScope): Promise<HsnMasterDetails[]>;
}

export const MASTER_LIST_SOURCE = Symbol("MASTER_LIST_SOURCE");
