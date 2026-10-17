import type { Quotation } from "@texawave-erp/api-types";
import { renderToStaticMarkup } from "react-dom/server";
import { QuotationPrintTemplate } from "./QuotationPrintTemplate";

/**
 * Browser-native print / "Save as PDF" — same mechanism as legacy's
 * `QuoteForm.tsx` `handlePrint` (popup window + static HTML +
 * `window.print()`), no PDF library, no backend endpoint. Returns
 * `false` when the popup was blocked so the caller can show a clear,
 * user-facing fallback instead of failing silently.
 */
export function printQuotation(quotation: Quotation): boolean {
  const markup = renderToStaticMarkup(
    <QuotationPrintTemplate quotation={quotation} />,
  );

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(quotation.quotationNumber)}</title>
  </head>
  <body>${markup}</body>
</html>`);
  win.document.close();

  win.onafterprint = () => win.close();

  // Matches legacy `QuoteForm.tsx handlePrint`'s own 250ms delay — gives
  // the popup's layout engine time to apply styles before printing.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // window may already be closed by the user — nothing to do.
    }
  }, 250);

  return true;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
