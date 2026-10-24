import type { FinancePaymentReceived } from "@texawave-erp/api-types";
import { numberToWords } from "@/features/crm/quotations/print/numberToWords";
import { formatDate, formatMoney } from "../../shared/format";

export interface PaymentReceiptTemplateProps {
  payment: FinancePaymentReceived;
}

export function PaymentReceiptTemplate({
  payment,
}: PaymentReceiptTemplateProps) {
  const amountNumber = Number(payment.amount || 0);
  const allocatedNumber = Number(payment.allocatedAmount || 0);
  const unallocatedNumber = Number(payment.unallocatedAmount || 0);
  const words = numberToWords(amountNumber, "Rupees", "Paise");

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
            Financial Management & Accounts Receivable
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
            OFFICIAL PAYMENT RECEIPT
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            {payment.paymentNumber}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Date: {formatDate(payment.paymentDate)}
          </div>
        </div>
      </div>

      {/* 2. Customer & Inflow Details Grid */}
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
            Received From (Customer)
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
            {payment.customerName}
          </div>
          {payment.customer?.name &&
            payment.customer.name !== payment.customerName && (
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Account: {payment.customer.name}
              </div>
            )}
          {payment.invoiceReference && (
            <div
              style={{ fontSize: "12px", color: "#0284c7", marginTop: "4px" }}
            >
              Primary Invoice Ref: <strong>{payment.invoiceReference}</strong>
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
            Payment & Settlement Info
          </div>
          <div style={{ fontSize: "13px", color: "#334155" }}>
            <strong>Payment Mode:</strong>{" "}
            {payment.paymentMode?.value || "Direct Receipt"}
          </div>
          {payment.referenceNumber && (
            <div style={{ fontSize: "13px", color: "#334155" }}>
              <strong>Transaction / UTR Ref:</strong> {payment.referenceNumber}
            </div>
          )}
          {payment.bankAccount && (
            <div style={{ fontSize: "13px", color: "#334155" }}>
              <strong>Deposited To:</strong> {payment.bankAccount.bankName} (
              {payment.bankAccount.accountName} -{" "}
              {payment.bankAccount.accountNumber})
            </div>
          )}
          <div style={{ fontSize: "13px", color: "#334155" }}>
            <strong>Status:</strong> {payment.status}
          </div>
        </div>
      </div>

      {/* 3. Invoice Allocations Breakdown */}
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
          Invoice Allocations Breakdown
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
              <th style={{ padding: "8px 12px", width: "40px" }}>#</th>
              <th style={{ padding: "8px 12px" }}>Invoice Reference</th>
              <th style={{ padding: "8px 12px" }}>Allocation Notes</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>
                Allocated Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations && payment.allocations.length > 0 ? (
              payment.allocations.map((alloc, idx) => (
                <tr
                  key={alloc.id || idx}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                    {alloc.invoiceReference}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>
                    {alloc.notes || "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {formatMoney(alloc.allocatedAmount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    color: "#64748b",
                    fontStyle: "italic",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {payment.invoiceReference
                    ? `Payment received against ${payment.invoiceReference}`
                    : "Unallocated customer deposit / on-account credit"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Financial Totals & Words */}
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
                Remarks / Notes
              </div>
              <div style={{ fontSize: "12px", color: "#334155" }}>
                {payment.notes}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: "260px" }}>
          <table
            style={{
              width: "100%",
              fontSize: "13px",
              borderCollapse: "collapse",
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>
                  Total Received:
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: "15px",
                    color: "#047857",
                  }}
                >
                  {formatMoney(amountNumber)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>
                  Total Allocated:
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {formatMoney(allocatedNumber)}
                </td>
              </tr>
              <tr style={{ borderTop: "1px solid #cbd5e1" }}>
                <td
                  style={{
                    padding: "6px 0",
                    color: "#0369a1",
                    fontWeight: 600,
                  }}
                >
                  Advance / Unallocated:
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0369a1",
                  }}
                >
                  {formatMoney(unallocatedNumber)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Authorization & Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: "1px solid #cbd5e1",
          paddingTop: "32px",
          marginTop: "32px",
        }}
      >
        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
          This is a computer-generated receipt document from TexaWave ERP.
          <br />
          Generated on {formatDate(new Date().toISOString())}
        </div>
        <div style={{ textAlign: "center", width: "180px" }}>
          <div
            style={{
              borderBottom: "1px solid #0f172a",
              marginBottom: "6px",
              height: "40px",
            }}
          />
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
}
