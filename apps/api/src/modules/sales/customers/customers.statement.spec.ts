import { Prisma } from "@texawave-erp/database";
import { buildStatement } from "./customers.statement.js";

const D = (v: string) => new Prisma.Decimal(v);
const date = (d: string) => new Date(`${d}T00:00:00Z`);

describe("buildStatement", () => {
  it("runs the balance from the opening figure, invoices before same-day payments", () => {
    const s = buildStatement(
      { from: "2026-10-01", to: "2026-11-19" },
      D("500.10"),
      [
        {
          id: 1,
          invoiceNumber: "INV-1",
          invoiceDate: date("2026-10-05"),
          totalAmount: D("1000.20"),
        },
      ],
      [
        {
          id: 9,
          paymentNumber: "PR-1",
          paymentDate: date("2026-10-05"),
          amount: D("300.05"),
          mode: "UPI",
          reference: "TXN1",
          invoiceNumber: "INV-1",
        },
      ],
    );
    expect(s.entries.map((e) => [e.type, e.balance])).toEqual([
      ["INVOICE", "1500.30"],
      ["PAYMENT", "1200.25"],
    ]);
    expect(s).toMatchObject({
      openingBalance: "500.10",
      totalInvoiced: "1000.20",
      totalReceived: "300.05",
      closingBalance: "1200.25",
    });
    expect(s.entries[1]?.description).toBe(
      "Payment against INV-1 · UPI · TXN1",
    );
  });

  it("is exact to the paisa and empty-safe", () => {
    const s = buildStatement(
      { from: null, to: null },
      D("0"),
      [
        {
          id: 1,
          invoiceNumber: "A",
          invoiceDate: date("2026-01-01"),
          totalAmount: D("0.10"),
        },
        {
          id: 2,
          invoiceNumber: "B",
          invoiceDate: date("2026-01-02"),
          totalAmount: D("0.20"),
        },
      ],
      [],
    );
    expect(s.closingBalance).toBe("0.30");
    expect(
      buildStatement({ from: null, to: null }, D("0"), [], []).entries,
    ).toEqual([]);
  });
});
