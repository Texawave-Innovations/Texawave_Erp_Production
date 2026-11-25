import { describe, expect, it } from "vitest";
import { blankDocument, type BlankDocumentKind } from "./blank-template.js";
import { renderSalesDocumentHtml } from "./document-pdf.template.js";
import type { CompanyProfile } from "../master-list/company-profile.service.js";

const company = {
  legalName: "Texawave Pvt Ltd",
  tagline: null,
  address: "1 Main Road",
  gstin: "33AAAAA0000A1Z5",
} as CompanyProfile;

const date = new Date("2026-11-21T00:00:00.000Z");

describe("blankDocument", () => {
  const cases: Array<[BlankDocumentKind, string, boolean]> = [
    ["quotation", "Quotation", true],
    ["proforma", "Proforma Invoice", true],
    ["tax-invoice", "Tax Invoice", true],
    ["delivery-challan", "Delivery Challan", false],
    ["returnable-dc", "Returnable Delivery Challan", false],
  ];

  it.each(cases)(
    "%s: letterhead, number, one empty row",
    (kind, title, priced) => {
      const doc = blankDocument(kind, company, "TW/0001", date);
      const html = renderSalesDocumentHtml(doc);
      expect(doc.title).toBe(title);
      expect(doc.pricing !== null).toBe(priced);
      expect(doc.lines).toHaveLength(1);
      expect(html).toContain("TEXAWAVE PVT LTD");
      expect(html).toContain("TW/0001");
      expect(html).toContain('<table class="items">');
      // No stray separators from the empty customer.
      expect(html).not.toContain("·");
    },
  );

  it("shows what the user has picked so far", () => {
    const doc = blankDocument("quotation", company, "TW/0001", date, {
      customer: {
        customerId: 7,
        customerCode: "CUS-1",
        companyName: "Global Enterprises",
        contactPerson: "Balaji",
        email: "b@global.test",
        mobile: "9876543210",
        gstin: null,
        stateCode: null,
        stateName: null,
        billingAddress: "12 Main Road",
        shippingAddress: null,
      },
      validity: "30 Days",
    });
    const html = renderSalesDocumentHtml(doc);
    expect(html).toContain("Global Enterprises");
    expect(html).toContain("12 Main Road");
    expect(html).toContain("30 Days");
  });
});
