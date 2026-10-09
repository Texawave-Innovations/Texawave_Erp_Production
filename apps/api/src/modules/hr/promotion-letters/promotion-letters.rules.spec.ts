import {
  compareSalaryHistory,
  formatPromotionDocumentNo,
  promotionDocPrefix,
  promotionDocType,
  type SalaryHistoryEntry,
} from "./promotion-letters.rules.js";

describe("promotion-letter rules", () => {
  it("numbers documents TW/HR/PRO/{FY}/NNN with a per-FY counter", () => {
    expect(promotionDocPrefix("26-27")).toBe("TW/HR/PRO/26-27/");
    expect(promotionDocType("26-27")).toBe("hr_promotion_letter_26-27");
    expect(formatPromotionDocumentNo("TW/HR/PRO/26-27/", 3, 7)).toBe(
      "TW/HR/PRO/26-27/007",
    );
    expect(formatPromotionDocumentNo("TW/HR/PRO/26-27/", 3, 1234)).toBe(
      "TW/HR/PRO/26-27/1234",
    );
  });

  it("orders salary history newest effective date first, promotions before revisions on a tie", () => {
    const entries: SalaryHistoryEntry[] = [
      { kind: "REVISION", id: 1, effectiveDate: "2025-04-01" },
      { kind: "REVISION", id: 2, effectiveDate: "2026-04-01" },
      { kind: "PROMOTION", id: 1, effectiveDate: "2026-04-01" },
      { kind: "PROMOTION", id: 3, effectiveDate: "2026-04-01" },
    ];
    expect(
      [...entries].sort(compareSalaryHistory).map((e) => `${e.kind}:${e.id}`),
    ).toEqual(["PROMOTION:3", "PROMOTION:1", "REVISION:2", "REVISION:1"]);
  });
});
