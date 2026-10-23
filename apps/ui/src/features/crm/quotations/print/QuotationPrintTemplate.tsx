import type { Quotation } from "@texawave-erp/api-types";
import { formatAddress } from "./formatAddress";
import { numberToWords } from "./numberToWords";

/**
 * Smallest-safe adaptation of legacy `QuotationPrintTemplate.tsx`
 * (Docs/CRM_QUOTES_PRINT_PARITY.md). Deliberate departures from legacy,
 * per approved decisions:
 *  - No CGST/SGST/IGST split or hardcoded tax percentage — CRM only has a
 *    single aggregate `totalTax`, shown under a generic "Tax" label.
 *  - `adjustment` (a genuine stored field, not a derived rounding
 *    residual) is labelled "Adjustment", not "Round Off".
 *  - No hardcoded bank-account fallback — the banking section is removed
 *    entirely rather than showing invented account details.
 *  - No company letterhead, logo, or GSTIN — none of those legacy values
 *    could be verified against an approved source for this tenant, so
 *    they are omitted rather than guessed.
 *  - No legacy watermark image — it was never confirmed as an approved
 *    brand asset, so it is not ported.
 *  - No HSN-code column — CRM line items never have one.
 *  - Pagination relies on the browser's native table-header repetition
 *    (`thead { display: table-header-group }`) plus `page-break-inside:
 *    avoid` on rows/sections, instead of porting legacy's hand-rolled
 *    pixel-height pagination heuristic, which was tuned to a different
 *    font stack and risked silently wrong page breaks in this app's CSS.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};
const CURRENCY_NAMES: Record<string, string> = {
  INR: "Rupees",
  USD: "US Dollars",
  EUR: "Euros",
  GBP: "Pounds",
  AED: "Dirhams",
};
const CURRENCY_SUBUNIT_NAMES: Record<string, string> = {
  INR: "Paise",
  USD: "Cents",
  EUR: "Cents",
  GBP: "Pence",
  AED: "Fils",
};

function fmt(num: number): string {
  return Number(num || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function QuotationPrintTemplate({
  quotation: q,
}: {
  quotation: Quotation;
}) {
  const currency = q.currency || "INR";
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const currencyName = CURRENCY_NAMES[currency] || currency;
  const subunitName = CURRENCY_SUBUNIT_NAMES[currency] || "Paise";

  const subtotal = Number(q.subtotal);
  const totalDiscount = Number(q.totalDiscount);
  const totalTax = Number(q.totalTax);
  const adjustment = Number(q.adjustment);
  const grandTotal = Number(q.grandTotal);

  const billingAddress = formatAddress({
    street: q.billingStreet,
    city: q.billingCity,
    state: q.billingState,
    postalCode: q.billingPostalCode,
    country: q.billingCountry,
  });
  const shippingAddress = formatAddress({
    street: q.shippingStreet,
    city: q.shippingCity,
    state: q.shippingState,
    postalCode: q.shippingPostalCode,
    country: q.shippingCountry,
  });
  const hasShipping = Boolean(
    q.shippingStreet ||
    q.shippingCity ||
    q.shippingState ||
    q.shippingPostalCode ||
    q.shippingCountry,
  );

  const details: Array<[string, string]> = [
    ["Quote Owner", q.quoteOwner || "—"],
    ["Customer Reference", q.customerReference || "—"],
    ["Payment Terms", q.paymentTerms || "—"],
    ["Delivery Terms", q.deliveryTerms || "—"],
    ["Carrier", q.carrier || "—"],
    ["Delivery Notes", q.deliveryNotes || "—"],
  ];

  return (
    <div className="qp-root">
      <style>{PRINT_CSS}</style>

      <table className="qp-meta">
        <tbody>
          <tr>
            <td>
              <div className="qp-title">QUOTATION</div>
              <div className="qp-subject">{q.subject}</div>
            </td>
            <td className="qp-meta-right">
              <div>
                <span className="qp-label">Quote No:</span> {q.quotationNumber}
              </div>
              <div>
                <span className="qp-label">Date:</span> {fmtDate(q.quoteDate)}
              </div>
              <div>
                <span className="qp-label">Valid Until:</span>{" "}
                {fmtDate(q.validUntil)}
              </div>
              <div>
                <span className="qp-label">Status:</span> {q.status}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="qp-parties">
        <tbody>
          <tr>
            <td className="qp-party-box">
              <div className="qp-box-title">Billing To</div>
              <div className="qp-party-name">{q.account.name}</div>
              <div className="qp-address">{billingAddress}</div>
            </td>
            {hasShipping ? (
              <td className="qp-party-box">
                <div className="qp-box-title">Shipping To</div>
                <div className="qp-address">{shippingAddress}</div>
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>

      <table className="qp-details">
        <tbody>
          {details.map(([label, value]) => (
            <tr key={label}>
              <td className="qp-label">{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="qp-items">
        <thead>
          <tr>
            <th className="qp-col-sno">S.No</th>
            <th>Description</th>
            <th className="qp-col-num">UOM</th>
            <th className="qp-col-num">Qty</th>
            <th className="qp-col-num">Unit Price ({symbol.trim()})</th>
            <th className="qp-col-num">Disc %</th>
            <th className="qp-col-num">Tax %</th>
            <th className="qp-col-num">Amount ({symbol.trim()})</th>
          </tr>
        </thead>
        <tbody>
          {q.lineItems.length === 0 ? (
            <tr>
              <td colSpan={8} className="qp-empty">
                No items added yet
              </td>
            </tr>
          ) : (
            q.lineItems
              .slice()
              .sort((a, b) => a.lineOrder - b.lineOrder)
              .map((item, idx) => (
                <tr key={item.id}>
                  <td className="qp-col-sno">{idx + 1}</td>
                  <td>{item.description}</td>
                  <td className="qp-col-num">{item.uom || "—"}</td>
                  <td className="qp-col-num">{Number(item.quantity)}</td>
                  <td className="qp-col-num">{fmt(Number(item.unitPrice))}</td>
                  <td className="qp-col-num">
                    {item.discountPercent ? Number(item.discountPercent) : 0}
                  </td>
                  <td className="qp-col-num">
                    {item.taxPercent ? Number(item.taxPercent) : 0}
                  </td>
                  <td className="qp-col-num">{fmt(Number(item.amount))}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      <table className="qp-totals">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td className="qp-col-num">
              {symbol}
              {fmt(subtotal)}
            </td>
          </tr>
          {totalDiscount > 0 ? (
            <tr>
              <td>Discount</td>
              <td className="qp-col-num">
                -{symbol}
                {fmt(totalDiscount)}
              </td>
            </tr>
          ) : null}
          {totalTax > 0 ? (
            <tr>
              <td>Tax</td>
              <td className="qp-col-num">
                {symbol}
                {fmt(totalTax)}
              </td>
            </tr>
          ) : null}
          {adjustment !== 0 ? (
            <tr>
              <td>Adjustment</td>
              <td className="qp-col-num">
                {symbol}
                {fmt(adjustment)}
              </td>
            </tr>
          ) : null}
          <tr className="qp-grand-total">
            <td>Grand Total</td>
            <td className="qp-col-num">
              {symbol}
              {fmt(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="qp-words">
        <span className="qp-label">Amount in Words:</span>{" "}
        <em>{numberToWords(grandTotal, currencyName, subunitName)}</em>
      </p>

      {q.termsConditions ? (
        <div className="qp-terms">
          <div className="qp-box-title">Terms &amp; Conditions</div>
          <div className="qp-terms-body">
            {q.termsConditions
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <div key={i}>{line}</div>
              ))}
          </div>
        </div>
      ) : null}

      {q.notes ? (
        <div className="qp-terms">
          <div className="qp-box-title">Notes</div>
          <div className="qp-terms-body">{q.notes}</div>
        </div>
      ) : null}
    </div>
  );
}

const PRINT_CSS = `
  .qp-root { font-family: 'Segoe UI', Arial, sans-serif; color: #222; font-size: 12px; width: 100%; box-sizing: border-box; }
  .qp-root table { width: 100%; border-collapse: collapse; box-sizing: border-box; }
  .qp-title { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  .qp-subject { color: #555; margin-top: 2px; }
  .qp-meta { margin-bottom: 14px; }
  .qp-meta-right { text-align: right; }
  .qp-label { font-weight: 700; color: #444; }
  .qp-parties { margin-bottom: 10px; }
  .qp-party-box { vertical-align: top; width: 50%; border: 1px solid #ccc; padding: 8px 10px; }
  .qp-box-title { font-weight: 700; text-transform: uppercase; font-size: 10.5px; color: #555; margin-bottom: 4px; }
  .qp-party-name { font-weight: 700; margin-bottom: 2px; }
  .qp-address { white-space: pre-line; }
  .qp-details { margin-bottom: 10px; font-size: 11px; }
  .qp-details td { padding: 1px 6px 1px 0; }
  .qp-items { margin-bottom: 10px; }
  .qp-items th, .qp-items td { border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; }
  .qp-items thead { display: table-header-group; }
  .qp-items tr { page-break-inside: avoid; break-inside: avoid; }
  .qp-col-num { text-align: right; }
  .qp-col-sno { text-align: center; width: 36px; }
  .qp-empty { text-align: center; color: #888; padding: 16px; }
  .qp-totals { max-width: 280px; margin-left: auto; margin-bottom: 10px; page-break-inside: avoid; }
  .qp-totals td { padding: 2px 4px; }
  .qp-grand-total td { font-weight: 800; border-top: 2px solid #333; padding-top: 4px; }
  .qp-words { margin: 10px 0; page-break-inside: avoid; }
  .qp-terms { border: 1px solid #ccc; padding: 8px 10px; margin-bottom: 10px; page-break-inside: avoid; }
  .qp-terms-body { font-size: 11px; white-space: pre-line; }

  @media print {
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0 !important; padding: 0 !important; }
  }
`;
