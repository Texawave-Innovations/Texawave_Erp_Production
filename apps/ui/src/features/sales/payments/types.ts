/** Mirrors apps/api/src/modules/sales/documents/payments.repository.ts
 * (toView). Money arrives as decimal strings. */

export interface Payment {
  id: number;
  invoiceId: number;
  paymentNumber: string;
  paymentDate: string;
  /** The payment's own due date for the remaining balance (may be null). */
  dueDate: string | null;
  /** The payment's due date, else the invoice's. */
  effectiveDueDate: string | null;
  /** Days past due while the invoice still has a balance, else null. */
  overdueDays: number | null;
  amount: string;
  mode: string;
  modeItemId: number | null;
  reference: string | null;
  notes: string | null;
  invoice: {
    id: number;
    invoiceNumber: string;
    invoiceType: "PROFORMA" | "TAX";
    invoiceDate: string;
    dueDate: string | null;
    status: string;
    totalAmount: string;
    amountReceived: string;
    balance: string;
  };
  customer: { id: number; customerCode: string; companyName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAlerts {
  overduePayments: number;
  overdueInvoices: number;
  overdueBalance: string;
}

export interface PaymentBody {
  amount: number;
  paymentDate: string;
  dueDate: string | null;
  modeItemId: number | null;
  mode?: string;
  reference: string | null;
  notes: string | null;
}

export interface CreatePaymentBody extends PaymentBody {
  invoiceId: number;
}
