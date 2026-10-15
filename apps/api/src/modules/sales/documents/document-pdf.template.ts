import { esc } from "../../../shared/pdf/html.js";
import type { CompanyProfile } from "../master-list/company-profile.service.js";
import type { BankDetails } from "./document-repository.helpers.js";
import type { CustomerSnapshot } from "./documents.rules.js";

/**
 * One A4 HTML template for every Sales document (quotation, proforma, tax
 * invoice, delivery challan), in the legacy screens' green layout. Pure;
 * every user-entered value goes through `esc()`. The logo, seal and
 * signature come from the Sales master list as server-made PNG/JPEG data
 * URIs (anything else is dropped); without an image the chosen name prints.
 */

export interface PrintableLine {
  description: string;
  hsnCode: string | null;
  quantity: string;
  unitPrice?: string;
  amount?: string;
}

export interface PrintablePricing {
  itemsSubtotal: string;
  transport: { description: string; hsn: string | null; charge: string } | null;
  taxMode: string;
  cgst: { rate: string; amount: string };
  sgst: { rate: string; amount: string };
  igst: { rate: string; amount: string };
  roundOff: string;
  total: string;
  amountInWords: string;
}

export interface PrintableDocument {
  title: string;
  number: string;
  partyLabel: string;
  meta: Array<[label: string, value: string]>;
  company: CompanyProfile;
  customer: CustomerSnapshot;
  lines: PrintableLine[];
  pricing: PrintablePricing | null;
  bank: BankDetails | null;
  termsTitle: string;
  terms: string[];
  note: string | null;
  preparedBy: string | null;
  sealName: string | null;
  signatureName: string | null;
  /** Data URIs from the master list (null = none). */
  images: {
    logo: string | null;
    seal: string | null;
    signature: string | null;
  };
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; margin: 0; }
  .sheet { border: 2px solid #4caf50; border-radius: 6px; }
  .head { display: flex; justify-content: space-between; padding: 12px 14px; }
  .brand { font-size: 17px; font-weight: 800; color: #2e7d32; }
  .brandrow { display: flex; align-items: center; gap: 10px; }
  .logo { max-height: 48px; max-width: 120px; }
  .stamp { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 6px; }
  .stamp img { max-height: 56px; max-width: 120px; }
  .tag { font-size: 10px; color: #4b5563; }
  .addr { text-align: right; font-size: 10px; max-width: 45%; }
  .band { background: linear-gradient(90deg, #4caf50, #8bc34a); color: #fff; text-align: center;
          font-weight: 700; letter-spacing: 3px; padding: 6px; }
  .parties { display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; }
  .box { border: 1.5px solid #4caf50; border-radius: 6px; padding: 8px 10px; }
  .box h4 { margin: 0 0 4px; color: #2e7d32; font-size: 10px; text-transform: uppercase; }
  .party { flex: 1; }
  .meta td { padding: 1px 4px; } .meta td:last-child { text-align: right; font-weight: 700; }
  table.items { width: calc(100% - 28px); margin: 0 14px; border-collapse: separate; border-spacing: 0;
                border: 1.5px solid #4caf50; border-radius: 6px; overflow: hidden; }
  table.items th { background: linear-gradient(90deg, #4caf50, #8bc34a); color: #fff; padding: 5px; font-size: 10px; }
  table.items td { padding: 5px; border-top: 1px solid #c8e6c9; }
  .num { text-align: right; } .ctr { text-align: center; }
  .totals { margin: 10px 14px 0 auto; width: 46%; border: 1.5px solid #4caf50; border-radius: 6px; overflow: hidden; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 8px; }
  .totals .grand { background: linear-gradient(90deg, #4caf50, #8bc34a); color: #fff; font-weight: 800; font-size: 13px; }
  .words { margin: 10px 14px; } .words b { color: #2e7d32; }
  .bottom { display: flex; gap: 12px; margin: 10px 14px; }
  .bank { flex: 1; }
  .sign { width: 40%; text-align: center; font-size: 10px; }
  .sign .line { border-top: 1.5px solid #4caf50; margin-top: 34px; padding-top: 3px; font-weight: 700; }
  .terms { margin: 10px 14px 14px; } .terms ol { margin: 0; padding-left: 16px; }
  .note { margin: 10px 14px; }
`;

/** Only image data URIs the server built; anything else is not printed. */
const SAFE_IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
function img(src: string | null, cls: string, alt: string): string {
  return src && SAFE_IMAGE.test(src)
    ? `<img class="${cls}" src="${src}" alt="${esc(alt)}" />`
    : "";
}

const nl = (v: string | null | undefined) =>
  v ? esc(v).replace(/\n/g, "<br />") : "";

function partyBlock(doc: PrintableDocument): string {
  const c = doc.customer;
  return `<div class="box party"><h4>${esc(doc.partyLabel)}</h4>
    <div><strong>${esc(c.companyName)}</strong></div>
    ${c.billingAddress ? `<div>${esc(c.billingAddress)}</div>` : ""}
    ${c.gstin ? `<div>GSTIN: ${esc(c.gstin)}</div>` : ""}
    ${c.stateName ? `<div>State: ${esc(c.stateName)} (${esc(c.stateCode)})</div>` : ""}
    <div>${esc(c.contactPerson)} · ${esc(c.mobile)} · ${esc(c.email)}</div>
  </div>`;
}

function itemsTable(doc: PrintableDocument): string {
  const priced = doc.pricing !== null;
  const head = priced
    ? `<th>S.No</th><th>Description</th><th>HSN Code</th><th>Qty</th><th>Unit Price (₹)</th><th>Total (₹)</th>`
    : `<th>S.No</th><th>Description of Item</th><th>HSN Code</th><th>Qty</th>`;
  const rows = doc.lines
    .map(
      (l, i) => `<tr><td class="ctr">${i + 1}</td><td>${esc(l.description)}</td>
        <td class="ctr">${esc(l.hsnCode ?? "")}</td><td class="ctr">${esc(l.quantity)}</td>${
          priced
            ? `<td class="num">${esc(l.unitPrice)}</td><td class="num">${esc(l.amount)}</td>`
            : ""
        }</tr>`,
    )
    .join("");
  return `<table class="items"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function totalsBlock(p: PrintablePricing): string {
  const row = (label: string, value: string) =>
    `<div><span>${esc(label)}</span><span>₹${esc(value)}</span></div>`;
  const taxes =
    p.taxMode === "INTRA"
      ? row(`CGST @ ${p.cgst.rate}%`, p.cgst.amount) +
        row(`SGST @ ${p.sgst.rate}%`, p.sgst.amount)
      : row(`IGST @ ${p.igst.rate}%`, p.igst.amount);
  return `<div class="totals">
    ${row("Subtotal", p.itemsSubtotal)}
    ${p.transport ? row(`${p.transport.description}${p.transport.hsn ? ` (HSN ${p.transport.hsn})` : ""}`, p.transport.charge) : ""}
    ${taxes}
    ${row("Round Off", p.roundOff)}
    <div class="grand"><span>Total Amount</span><span>₹${esc(p.total)}</span></div>
  </div>
  <div class="box words"><b>AMOUNT IN WORDS:</b> <i>${esc(p.amountInWords)} /-</i></div>`;
}

function bankBlock(bank: BankDetails | null): string {
  if (!bank) return `<div class="bank"></div>`;
  return `<div class="box bank"><h4>Banking Details</h4>
    <div>Bank Name: ${esc(bank.bankName ?? "")}</div>
    <div>Account No: ${esc(bank.accountNumber ?? "")}</div>
    <div>Branch: ${esc(bank.branch ?? "")}</div>
    <div>IFSC Code: ${esc(bank.ifsc ?? "")}</div>
  </div>`;
}

export function renderSalesDocumentHtml(doc: PrintableDocument): string {
  const co = doc.company;
  const meta = doc.meta
    .map(([k, v]) => `<tr><td>${esc(k)}:</td><td>${esc(v)}</td></tr>`)
    .join("");
  const terms = doc.terms.length
    ? `<div class="box terms"><h4>${esc(doc.termsTitle)}</h4><ol>${doc.terms
        .map((t) => `<li>${esc(t)}</li>`)
        .join("")}</ol></div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(doc.title)} ${esc(doc.number)}</title><style>${STYLE}</style></head>
<body><div class="sheet">
  <div class="head">
    <div class="brandrow">${img(doc.images.logo, "logo", co.legalName)}
      <div><div class="brand">${esc(co.legalName.toUpperCase())}</div>
      ${co.tagline ? `<div class="tag">${esc(co.tagline)}</div>` : ""}</div></div>
    <div class="addr">${nl(co.address)}${co.gstin ? `<br /><strong>GSTIN: ${esc(co.gstin)}</strong>` : ""}</div>
  </div>
  <div class="band">${esc(doc.title.toUpperCase())}</div>
  <div class="parties">${partyBlock(doc)}
    <div class="box"><table class="meta">${meta}</table></div></div>
  ${itemsTable(doc)}
  ${doc.pricing ? totalsBlock(doc.pricing) : ""}
  ${doc.note ? `<div class="box note"><h4>Note</h4>${nl(doc.note)}</div>` : ""}
  <div class="bottom">
    ${doc.pricing ? bankBlock(doc.bank) : `<div class="bank">${doc.preparedBy ? `<strong>Prepared By:</strong> ${esc(doc.preparedBy)}` : ""}</div>`}
    <div class="sign"><strong>For ${esc(co.legalName)}</strong>
      <div class="stamp">${
        doc.images.seal
          ? img(doc.images.seal, "seal", doc.sealName ?? "Seal")
          : doc.sealName
            ? `<div>[${esc(doc.sealName)}]</div>`
            : ""
      }${
        doc.images.signature
          ? img(
              doc.images.signature,
              "signature",
              doc.signatureName ?? "Signature",
            )
          : doc.signatureName
            ? `<div>${esc(doc.signatureName)}</div>`
            : ""
      }</div>
      <div class="line">AUTHORIZED SIGNATORY</div></div>
  </div>
  ${terms}
</div></body></html>`;
}
