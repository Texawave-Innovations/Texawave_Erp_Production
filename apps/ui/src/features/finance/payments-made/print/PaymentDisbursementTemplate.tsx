import type { FinancePaymentMade } from "@texawave-erp/api-types";
import { numberToWords } from "@/features/crm/quotations/print/numberToWords";
import { formatDate, formatMoney } from "../../shared/format";

export interface PaymentDisbursementTemplateProps {
  payment: FinancePaymentMade;
}

export function PaymentDisbursementTemplate({
  payment,
}: PaymentDisbursementTemplateProps) {
  const amountNumber = Number(payment.amount || 0);
  const words = numberToWords(amountNumber, "Rupees", "Paise");

  const creditAccountName = payment.bankAccount
    ? `Bank Account: ${payment.bankAccount.accountName} (${payment.bankAccount.accountNumber})`
    : "Cash on Hand (1010)";
  const creditAccountCode = payment.bankAccount ? "1020" : "1010";

  return (
    <div
      style={{
        fontFamily:
          "Nunito Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1e293b",
        backgroundColor: "#ffffff",
        padding: "32px",
        maxWidth: "800px",
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "2px solid #0284c7",
          paddingBottom: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            TEXAWAVE ERP
          </h1>
          <p
            style={{
              fontSize: "12px",
              color: "#64748b",
              margin: "4px 0 0 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Financial Management & Accounts Payable
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              color: "#0369a1",
              fontSize: "13px",
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: "6px",
              marginBottom: "6px",
            }}
          >
            DISBURSEMENT VOUCHER
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            {payment.paymentNumber}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Date: {formatDate(payment.paymentDate)}
          </div>
        </div>
      </div>

      {/* 2. Vendor & Disbursement Details Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Disbursed To (Payee / Supplier)
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
            {payment.vendorName}
          </div>
          {payment.billReference && (
            <div
              style={{ fontSize: "12px", color: "#0284c7", marginTop: "4px" }}
            >
              Bill / PO Reference: <strong>{payment.billReference}</strong>
            </div>
          )}
          {payment.scmSupplierPaymentId && (
            <div
              style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}
            >
              SCM Supplier Payment ID: #{payment.scmSupplierPaymentId}
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Payment & Settlement Channel
          </div>
          <div style={{ fontSize: "13px", color: "#334155" }}>
            <strong>Payment Mode:</strong>{" "}
            {payment.paymentMode?.value || "Direct Disbursement"}
          </div>
          {payment.referenceNumber && (
            <div style={{ fontSize: "13px", color: "#334155" }}>
              <strong>Transaction / UTR Ref:</strong> {payment.referenceNumber}
            </div>
          )}
          {payment.bankAccount && (
            <div style={{ fontSize: "13px", color: "#334155" }}>
              <strong>Source Bank:</strong> {payment.bankAccount.accountName} (
              {payment.bankAccount.accountNumber})
            </div>
          )}
          <div style={{ fontSize: "13px", color: "#334155" }}>
            <strong>Status:</strong> {payment.status}
          </div>
        </div>
      </div>

      {/* 3. General Ledger Double-Entry Breakdown */}
      <div style={{ marginBottom: "24px" }}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#0f172a",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          General Ledger Posting Breakdown
        </h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f1f5f9",
                borderBottom: "2px solid #cbd5e1",
              }}
            >
              <th style={{ padding: "8px 12px", width: "100px" }}>Account</th>
              <th style={{ padding: "8px 12px" }}>Account Title / Narration</th>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  width: "120px",
                }}
              >
                Debit (₹)
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  width: "120px",
                }}
              >
                Credit (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td
                style={{
                  padding: "8px 12px",
                  color: "#0284c7",
                  fontWeight: 700,
                }}
              >
                2010
              </td>
              <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                Accounts Payable ({payment.vendorName})
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Liability settlement for bill{" "}
                  {payment.billReference || "general settlement"}
                </div>
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {formatMoney(amountNumber)}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  color: "#94a3b8",
                }}
              >
                —
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
              <td
                style={{
                  padding: "8px 12px",
                  color: "#0284c7",
                  fontWeight: 700,
                }}
              >
                {creditAccountCode}
              </td>
              <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                {creditAccountName}
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Disbursement fund deduction via{" "}
                  {payment.paymentMode?.value || "Banking"}
                </div>
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  color: "#94a3b8",
                }}
              >
                —
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {formatMoney(amountNumber)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#f8fafc", fontWeight: 800 }}>
              <td
                colSpan={2}
                style={{ padding: "10px 12px", textAlign: "right" }}
              >
                Total (Balanced):
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  color: "#0284c7",
                }}
              >
                {formatMoney(amountNumber)}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  color: "#0284c7",
                }}
              >
                {formatMoney(amountNumber)}
              </td>
            </tr>
          </tfoot>
        </table>
        {payment.journalEntry && (
          <div
            style={{
              fontSize: "12px",
              color: "#0369a1",
              backgroundColor: "#f0f9ff",
              padding: "6px 12px",
              borderRadius: "4px",
              marginTop: "8px",
              border: "1px solid #bae6fd",
            }}
          >
            Linked Journal Entry:{" "}
            <strong>{payment.journalEntry.entryNumber}</strong> (Posted on{" "}
            {formatDate(payment.journalEntry.entryDate)})
          </div>
        )}
      </div>

      {/* 4. Amount in Words & Notes */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          gap: "24px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Amount in Words
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#0f172a",
              fontStyle: "italic",
              backgroundColor: "#f8fafc",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            {words}
          </div>

          {payment.notes && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Remittance Remarks / Narration
              </div>
              <div style={{ fontSize: "12px", color: "#334155" }}>
                {payment.notes}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: "240px" }}>
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "14px",
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Total Disbursed Amount
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0284c7",
              }}
            >
              {formatMoney(amountNumber)}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Authorization & Signatures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          borderTop: "1px solid #cbd5e1",
          paddingTop: "32px",
          marginTop: "32px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              borderBottom: "1px solid #94a3b8",
              marginBottom: "6px",
              height: "36px",
            }}
          />
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
            Prepared By
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            Finance Officer
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              borderBottom: "1px solid #94a3b8",
              marginBottom: "6px",
              height: "36px",
            }}
          />
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
            Verified By
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            Accounts Lead
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              borderBottom: "1px solid #0f172a",
              marginBottom: "6px",
              height: "36px",
            }}
          />
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
            Authorized Signatory
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>Management</div>
        </div>
      </div>

      {/* 6. Footer Notice */}
      <div
        style={{
          marginTop: "32px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "12px",
          fontSize: "11px",
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        This is an official disbursement voucher generated from TexaWave ERP.
        Generated on {formatDate(new Date().toISOString())}
      </div>
    </div>
  );
}
