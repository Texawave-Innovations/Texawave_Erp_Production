import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildSheetModel,
  buildWorkbook,
  DATE_FORMAT,
  sanitiseSheetName,
  xlsxFileName,
  type SheetColumn,
} from "./spreadsheet.js";

/** exceljs types leave the frozen-pane fields off its view type. */
function frozenRows(ws: ExcelJS.Worksheet): number | undefined {
  return (ws.views[0] as { ySplit?: number } | undefined)?.ySplit;
}

interface Row {
  code: string;
  day: string;
  at: string;
  amount: string | number;
  qty: number;
  note?: string;
}

const columns: SheetColumn<Row>[] = [
  { header: "Code", value: (r) => r.code },
  { header: "Date", value: (r) => r.day, type: "date" },
  { header: "Logged at", value: (r) => r.at, type: "datetime" },
  { header: "Amount", value: (r) => r.amount, type: "amount" },
  { header: "Qty", value: (r) => r.qty, type: "integer" },
  { header: "Note", value: (r) => r.note, type: "text" },
];

const rows: Row[] = [
  {
    code: "007",
    day: "18/11/2026",
    at: "2026-11-18T09:04:06.000Z",
    amount: "1,23,456.5",
    qty: 3,
    note: "=SUM(A1:A9)",
  },
  { code: "EMP-000012", day: "2026-11-05", at: "", amount: 10, qty: 12 },
];

test("dates become real calendar days, never re-read by locale", () => {
  const model = buildSheetModel({ name: "T", columns, rows });
  const first = model.rows[0]![1] as Date;
  const second = model.rows[1]![1] as Date;
  assert.equal(first.toISOString(), "2026-11-18T00:00:00.000Z");
  // 2026-11-05 is 5 November, not May 11.
  assert.equal(second.toISOString(), "2026-11-05T00:00:00.000Z");
});

test("datetime shows Indian wall-clock time (UTC 09:04 -> 14:34 IST)", () => {
  const model = buildSheetModel({ name: "T", columns, rows });
  assert.equal(
    (model.rows[0]![2] as Date).toISOString(),
    "2026-11-18T14:34:06.000Z",
  );
  assert.equal(model.rows[1]![2], null);
});

test("an instant near midnight UTC lands on the correct IST day", () => {
  const model = buildSheetModel({
    name: "T",
    columns: [{ header: "D", value: (r: string) => r, type: "date" }],
    rows: ["2026-11-17T20:00:00.000Z"], // 01:30 on the 18th in IST
  });
  assert.equal(
    (model.rows[0]![0] as Date).toISOString(),
    "2026-11-18T00:00:00.000Z",
  );
});

test("amounts are numbers; text codes are untouched", () => {
  const model = buildSheetModel({ name: "T", columns, rows });
  assert.equal(model.rows[0]![3], 123456.5);
  assert.equal(model.rows[1]![3], 10);
  assert.equal(model.rows[0]![0], "007");
  assert.equal(model.rows[0]![5], "=SUM(A1:A9)");
});

test("unparseable dates and numbers keep their text instead of vanishing", () => {
  const model = buildSheetModel({
    name: "T",
    columns: [
      { header: "D", value: (r: string) => r, type: "date" },
      { header: "N", value: (r: string) => r, type: "amount" },
    ],
    rows: ["31/02/2026"],
  });
  assert.equal(model.rows[0]![0], "31/02/2026");
  assert.equal(model.rows[0]![1], "31/02/2026");
});

test("widths fit the content and always fit a formatted date", () => {
  const model = buildSheetModel({ name: "T", columns, rows });
  assert.ok(model.widths[1]! >= 13, `date width ${model.widths[1]}`);
  assert.ok(model.widths[2]! >= 19, `datetime width ${model.widths[2]}`);
  assert.ok(model.widths[0]! >= "EMP-000012".length);
  const wide = buildSheetModel({
    name: "T",
    columns: [{ header: "H", value: (r: string) => r }],
    rows: ["x".repeat(500)],
  });
  assert.equal(wide.widths[0], 60);
});

test("helpers", () => {
  assert.equal(sanitiseSheetName("A/B:C*?[x]"), "A B C   x");
  assert.equal(sanitiseSheetName("   "), "Sheet1");
  assert.equal(sanitiseSheetName("x".repeat(40)).length, 31);
  assert.equal(xlsxFileName("report.csv"), "report.xlsx");
  assert.equal(xlsxFileName("report"), "report.xlsx");
});

test("written .xlsx has real date cells, formats, widths and a frozen header", async () => {
  const buffer = await buildWorkbook([{ name: "Report", columns, rows }]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Report")!;
  assert.ok(ws, "sheet exists");

  const date = ws.getCell("B2");
  assert.ok(date.value instanceof Date, "B2 is a real date");
  assert.equal(date.numFmt, DATE_FORMAT);
  assert.equal((date.value as Date).toISOString(), "2026-11-18T00:00:00.000Z");

  assert.equal(typeof ws.getCell("D2").value, "number");
  assert.equal(ws.getCell("D2").numFmt, "#,##0.00");
  assert.equal(ws.getCell("A2").value, "007");
  assert.equal(ws.getCell("A2").type, ExcelJS.ValueType.String);
  assert.equal(ws.getCell("F2").value, "=SUM(A1:A9)"); // a string, not a formula
  assert.equal(ws.getCell("F2").type, ExcelJS.ValueType.String);

  assert.ok(ws.getColumn(2).width! >= 13, "date column wide enough");
  assert.equal(ws.getCell("A1").font?.bold, true);
  assert.equal(ws.views[0]?.state, "frozen");
  assert.equal(frozenRows(ws), 1);
});

test("duplicate sheet names get a suffix instead of failing", async () => {
  const buffer = await buildWorkbook([
    { name: "Data", columns, rows },
    { name: "data", columns, rows },
  ]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  assert.equal(wb.worksheets.length, 2);
});

test("title row and totals row: summed, styled, header offset", async () => {
  const buffer = await buildWorkbook([
    {
      name: "Payments",
      title: "TexaOne ERP - Payments",
      totals: "TOTALS",
      columns,
      rows,
    },
  ]);
  const model = buildSheetModel({
    name: "Payments",
    title: "t",
    totals: true,
    columns,
    rows,
  });
  // Amount 123456.5 + 10, Qty 3 + 12, text/date columns blank.
  assert.deepEqual(model.totalsRow, ["TOTALS", null, null, 123466.5, 15, null]);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Payments")!;
  assert.equal(ws.getCell("A1").value, "TexaOne ERP - Payments");
  assert.equal(ws.getCell("A2").value, "Code", "header is on row 2");
  assert.equal(
    ws.getCell("B3").type,
    ExcelJS.ValueType.Date,
    "data from row 3",
  );
  assert.equal(ws.getCell("A5").value, "TOTALS");
  assert.equal(ws.getCell("D5").value, 123466.5);
  assert.equal(frozenRows(ws), 2);
  assert.equal(ws.getCell("A2").font?.bold, true);
});

test("no totals row unless asked for", () => {
  assert.equal(buildSheetModel({ name: "T", columns, rows }).totalsRow, null);
});

test("a column can opt out of the totals row", () => {
  const model = buildSheetModel({
    name: "T",
    totals: true,
    columns: [
      {
        header: "Name",
        value: (r: { n: string; a: number; b: number }) => r.n,
      },
      { header: "Declared", value: (r) => r.a, type: "amount", total: false },
      { header: "Verified", value: (r) => r.b, type: "amount" },
    ],
    rows: [
      { n: "x", a: 5, b: 1.1 },
      { n: "y", a: 7, b: 2.2 },
    ],
  });
  assert.deepEqual(model.totalsRow, ["TOTALS", null, 3.3]);
});
