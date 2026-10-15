import { renderSalesDocumentHtml } from "./document-pdf.template.js";
import type { PrintableDocument } from "./document-pdf.template.js";

const doc = (over: Partial<PrintableDocument> = {}): PrintableDocument => ({
  title: "Quotation",
  number: "TW/QUO/26-27/0001",
  partyLabel: "Quotation To",
  meta: [["QO No", "TW/QUO/26-27/0001"]],
  company: {
    legalName: "Texawave Innovations Private Limited",
    tagline: null,
    address: "Chennai",
    gstin: "33AAMCT4293K1ZU",
    stateCode: "33",
    stateName: "Tamil Nadu",
    pan: null,
    email: null,
    phone: null,
    hasLogo: false,
  },
  customer: {
    customerId: 1,
    customerCode: "CUS-IN-001",
    companyName: "<script>alert(1)</script> Ltd",
    contactPerson: "A",
    email: "a@b.test",
    mobile: "+91 9876543210",
    gstin: null,
    stateCode: "33",
    stateName: "Tamil Nadu",
    billingAddress: null,
    shippingAddress: null,
  },
  lines: [
    {
      description: "Panel & <b>wiring</b>",
      hsnCode: "8471",
      quantity: "1",
      unitPrice: "600.00",
      amount: "600.00",
    },
  ],
  pricing: {
    itemsSubtotal: "600.00",
    transport: null,
    taxMode: "INTRA",
    cgst: { rate: "9", amount: "54.00" },
    sgst: { rate: "9", amount: "54.00" },
    igst: { rate: "0", amount: "0.00" },
    roundOff: "0.00",
    total: "708.00",
    amountInWords: "Rupees Seven Hundred Eight Only",
  },
  bank: { bankName: "HDFC Bank", ifsc: "HDFC0001256" },
  termsTitle: "Terms & Conditions",
  terms: ["Valid 30 days"],
  note: null,
  preparedBy: "Rafic",
  sealName: null,
  signatureName: null,
  images: { logo: null, seal: null, signature: null },
  ...over,
});

describe("sales document template", () => {
  it("escapes every user-entered value", () => {
    const html = renderSalesDocumentHtml(doc());
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Panel &amp; &lt;b&gt;wiring&lt;/b&gt;");
  });

  it("prints CGST/SGST intra-state and IGST inter-state", () => {
    const intra = renderSalesDocumentHtml(doc());
    expect(intra).toContain("CGST @ 9%");
    expect(intra).not.toContain("IGST @");
    const inter = renderSalesDocumentHtml(
      doc({
        pricing: {
          ...doc().pricing!,
          taxMode: "INTER",
          igst: { rate: "18", amount: "108.00" },
        },
      }),
    );
    expect(inter).toContain("IGST @ 18%");
    expect(inter).not.toContain("CGST @");
  });

  it("a delivery challan has no prices, totals or bank block", () => {
    const html = renderSalesDocumentHtml(
      doc({ title: "Delivery Challan", pricing: null, bank: null }),
    );
    expect(html).not.toContain("Unit Price");
    expect(html).not.toContain("Total Amount");
    expect(html).not.toContain("Banking Details");
    expect(html).toContain("DELIVERY CHALLAN");
  });

  it("prints the logo, seal and signature images; names when there is no image", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const html = renderSalesDocumentHtml(
      doc({
        sealName: "Corporate Seal",
        signatureName: "MD Signature",
        images: { logo: png, seal: png, signature: null },
      }),
    );
    expect(html).toContain(`<img class="logo" src="${png}"`);
    expect(html).toContain(`<img class="seal" src="${png}"`);
    expect(html).not.toContain("[Corporate Seal]");
    expect(html).toContain("MD Signature");
  });

  it("never prints an image that is not a PNG/JPEG data URI", () => {
    const html = renderSalesDocumentHtml(
      doc({
        images: {
          logo: 'x" onerror="alert(1)',
          seal: "https://evil.test/seal.png",
          signature: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.test");
  });

  it("goods-only table and a titled note (returnable DC)", () => {
    const html = renderSalesDocumentHtml(
      doc({
        title: "Returnable Delivery Challan",
        pricing: null,
        hideHsn: true,
        lines: [{ description: "Demo panel", hsnCode: null, quantity: "2" }],
        note: "Return by <date>",
        noteTitle: "Returnable Terms",
      }),
    );
    expect(html).toContain("<th>Description of Goods</th><th>Quantity</th>");
    expect(html).not.toContain("HSN Code");
    expect(html).toContain("<h4>Returnable Terms</h4>Return by &lt;date&gt;");
  });

  it("a summary box and no items table (payment receipt)", () => {
    const html = renderSalesDocumentHtml(
      doc({
        title: "Payment Receipt",
        pricing: null,
        lines: [],
        summary: [["Amount Received", "₹<508.00>"]],
      }),
    );
    expect(html).not.toContain('<table class="items">');
    expect(html).toContain(
      "<span>Amount Received</span><strong>₹&lt;508.00&gt;</strong>",
    );
  });
});
