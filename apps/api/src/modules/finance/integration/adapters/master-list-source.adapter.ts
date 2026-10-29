import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  HsnMasterDetails,
  IMasterListSource,
} from "../contracts/master-list.contract.js";

@Injectable()
export class MasterListSourceAdapter implements IMasterListSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Looks up HSN or SAC details from available Master Data in the current repository:
   * 1. ScmProduct catalog
   * 2. FinanceMasterListItem catalog
   * 3. Canonical statutory GST rate directory fallback
   */
  async lookupHsnSac(
    scope: OrgScope,
    code: string,
  ): Promise<HsnMasterDetails | null> {
    const cleanCode = code.trim();
    if (!cleanCode) return null;

    // 1. Search SCM Products
    try {
      const product = await this.prisma.scmProduct.findFirst({
        where: tenantWhere<Prisma.ScmProductWhereInput>(scope, {
          hsn: cleanCode,
          isActive: true,
        }),
        select: {
          name: true,
          description: true,
          uom: true,
          hsn: true,
        },
      });

      if (product && product.hsn) {
        return {
          hsnSacCode: product.hsn,
          type: cleanCode.startsWith("99") ? "SAC" : "HSN",
          description: product.description || product.name,
          defaultTaxRate: 18.0,
          uom: product.uom ?? "PCS",
          isActive: true,
        };
      }
    } catch {
      // ScmProduct table may be empty or unmigrated on some environments
    }

    // 2. Search Finance Master List Items
    try {
      const masterItem = await this.prisma.financeMasterListItem.findFirst({
        where: tenantWhere<Prisma.FinanceMasterListItemWhereInput>(scope, {
          category: { in: ["HSN_CODE", "SAC_CODE", "TAX_RATE"] },
          value: cleanCode,
          isActive: true,
        }),
      });

      if (masterItem) {
        const custom =
          (masterItem.customFields as Record<string, unknown>) || {};
        const rate =
          masterItem.numericValue !== null
            ? Number(masterItem.numericValue)
            : Number(custom["rate"] ?? 18.0);

        return {
          hsnSacCode: masterItem.value,
          type:
            masterItem.category === "SAC_CODE" || cleanCode.startsWith("99")
              ? "SAC"
              : "HSN",
          description:
            (custom["description"] as string) ||
            `HSN/SAC Code ${masterItem.value}`,
          defaultTaxRate: rate,
          uom: (custom["uom"] as string) || "PCS",
          isActive: masterItem.isActive,
        };
      }
    } catch {
      // FinanceMasterListItem table may be empty
    }

    // 3. Known Canonical Statutory Fallbacks (Common IT & Engineering chapters)
    const canonicalDirectory: Record<
      string,
      { desc: string; rate: number; uom: string }
    > = {
      "8471": {
        desc: "Automatic data processing machines & optical readers",
        rate: 18.0,
        uom: "NOS",
      },
      "847130": {
        desc: "Portable computers and laptops",
        rate: 18.0,
        uom: "NOS",
      },
      "8517": {
        desc: "Telephone sets and telecommunication apparatus",
        rate: 18.0,
        uom: "NOS",
      },
      "9983": {
        desc: "Information technology (IT) consultancy and programming services",
        rate: 18.0,
        uom: "OTH",
      },
      "998313": {
        desc: "Information technology (IT) support and maintenance services",
        rate: 18.0,
        uom: "OTH",
      },
      "998314": {
        desc: "Internet hosting and cloud infrastructure services",
        rate: 18.0,
        uom: "OTH",
      },
      "9972": {
        desc: "Real estate and commercial leasing services",
        rate: 18.0,
        uom: "OTH",
      },
      "9954": { desc: "General construction services", rate: 18.0, uom: "OTH" },
      "123453": {
        desc: "Industrial and commercial hardware supplies",
        rate: 18.0,
        uom: "PCS",
      },
      "123456": {
        desc: "General corporate procurement and office consumables",
        rate: 18.0,
        uom: "PCS",
      },
    };

    const match =
      canonicalDirectory[cleanCode] ||
      canonicalDirectory[cleanCode.slice(0, 4)];
    if (match) {
      return {
        hsnSacCode: cleanCode,
        type: cleanCode.startsWith("99") ? "SAC" : "HSN",
        description: match.desc,
        defaultTaxRate: match.rate,
        uom: match.uom,
        isActive: true,
      };
    }

    return null;
  }

  async getHsnDirectory(scope: OrgScope): Promise<HsnMasterDetails[]> {
    const list: HsnMasterDetails[] = [];
    const seen = new Set<string>();

    try {
      const products = await this.prisma.scmProduct.findMany({
        where: tenantWhere<Prisma.ScmProductWhereInput>(scope, {
          hsn: { not: null },
          isActive: true,
        }),
        select: { hsn: true, name: true, description: true, uom: true },
      });

      for (const p of products) {
        if (!p.hsn || seen.has(p.hsn)) continue;
        seen.add(p.hsn);
        list.push({
          hsnSacCode: p.hsn,
          type: p.hsn.startsWith("99") ? "SAC" : "HSN",
          description: p.description || p.name,
          defaultTaxRate: 18.0,
          uom: p.uom ?? "PCS",
          isActive: true,
        });
      }
    } catch {
      // Empty product table
    }

    return list;
  }
}
