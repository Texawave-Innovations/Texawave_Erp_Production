const fs = require("fs");
const path = require("path");

function addDatabaseSheet(
  wb,
  FONT_NAME,
  titleFont,
  subTitleFont,
  sectionFont,
  headerFont,
  cellFont,
  boldCellFont,
  titleFill,
  headerFill,
  altRowFill,
  sectionHeaderFill,
  thinBorder,
  statusStyles,
) {
  console.log("Building Sheet 3: Database & Data Model Reference...");
  const ws = wb.addWorksheet("Database & Data Model Reference", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  const cols = [
    { header: "Model Name", key: "model", width: 26 },
    { header: "Database Schema", key: "schema", width: 16 },
    { header: "Table Name", key: "table", width: 26 },
    { header: "Field Name", key: "field", width: 26 },
    { header: "Prisma Type", key: "prismaType", width: 18 },
    { header: "Database Type", key: "dbType", width: 20 },
    { header: "Required / Optional", key: "reqOpt", width: 18 },
    { header: "Default Value", key: "defaultVal", width: 20 },
    { header: "Primary Key", key: "pk", width: 14 },
    { header: "Foreign Key & Referenced Model", key: "fk", width: 34 },
    { header: "Unique Constraints", key: "unique", width: 34 },
    { header: "Indexes", key: "indexes", width: 34 },
    { header: "Organization Scope", key: "scope", width: 18 },
    { header: "Business Purpose", key: "purpose", width: 45 },
    { header: "Related API Endpoints", key: "api", width: 38 },
    { header: "Related UI Feature", key: "ui", width: 30 },
    { header: "Accounting Significance", key: "accounting", width: 42 },
    { header: "GST Significance", key: "gst", width: 42 },
    { header: "Migration Reference", key: "migration", width: 38 },
    { header: "Source File", key: "sourceFile", width: 44 },
  ];
  ws.columns = cols;

  ws.mergeCells("A1:T1");
  const a1 = ws.getCell("A1");
  a1.value =
    "TexaWave ERP — Complete Database & Data Model Reference (PostgreSQL multi-schema)";
  a1.font = titleFont;
  a1.fill = titleFill;
  a1.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:T2");
  const a2 = ws.getCell("A2");
  a2.value =
    '20 Comprehensive Columns per Field | 11 Core Models in @@schema("finance") + Latest Expense GST/ITC Fields Migration (186 Scalar Fields)';
  a2.font = subTitleFont;
  a2.fill = titleFill;
  a2.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;

  const hRow = ws.getRow(4);
  cols.forEach((col, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = col.header;
    c.font = headerFont;
    c.fill = headerFill;
    c.border = thinBorder;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hRow.height = 30;

  // Load all 186 scalar field records
  const dbData = JSON.parse(
    fs.readFileSync(
      path.resolve("scratch/generated_all_db_records.json"),
      "utf8",
    ),
  );

  let rIdx = 5;
  dbData.forEach((row, i) => {
    const r = ws.getRow(rIdx);
    r.height = 24;
    const values = [
      row.model,
      row.schema,
      row.table,
      row.field,
      row.prismaType,
      row.dbType,
      row.reqOpt,
      row.defaultVal,
      row.pk,
      row.fk,
      row.unique,
      row.indexes,
      row.scope,
      row.purpose,
      row.api,
      row.ui,
      row.accounting,
      row.gst,
      row.migration,
      row.sourceFile,
    ];
    values.forEach((v, c) => {
      const cell = r.getCell(c + 1);
      cell.value = v;
      cell.font = cellFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal:
          c === 1 || c === 4 || c === 6 || c === 8 || c === 12
            ? "center"
            : "left",
        wrapText: true,
      };
      if (i % 2 === 1) cell.fill = altRowFill;
      if (c === 0) cell.font = boldCellFont;
      if (c === 8 && v === "PK") {
        cell.font = {
          name: FONT_NAME,
          size: 8.5,
          bold: true,
          color: { argb: "FF0369A1" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0F2FE" },
        };
      }
    });
    rIdx++;
  });

  ws.autoFilter = { from: "A4", to: `T${rIdx - 1}` };
  console.log(
    `Sheet 3 built with ${dbData.length} database field records across 11 models.`,
  );
}

module.exports = { addDatabaseSheet };
