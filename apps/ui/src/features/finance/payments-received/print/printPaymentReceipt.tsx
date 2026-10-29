import type { FinancePaymentReceived } from "@texawave-erp/api-types";
import { PaymentReceiptTemplate } from "./PaymentReceiptTemplate";

/**
 * Browser-native print / "Save as PDF" for Customer Payment Receipts.
 * Renders static markup into an isolated printable popup and invokes window.print().
 */
export async function printPaymentReceipt(
  payment: FinancePaymentReceived,
): Promise<boolean> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(
    <PaymentReceiptTemplate payment={payment} />,
  );

  const win = window.open("", "_blank", "width=850,height=950");
  if (!win) return false;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(payment.paymentNumber || "Payment Receipt")}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 15mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @media print {
        body {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>${markup}</body>
</html>`);
  win.document.close();

  win.onafterprint = () => win.close();

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // Popup might be closed by user
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
