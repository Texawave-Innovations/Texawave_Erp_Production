const fs = require("fs");
const path = require("path");
const xlsx = require(path.resolve("apps/ui/node_modules/xlsx"));
const ExcelJS = require(path.resolve("apps/ui/node_modules/exceljs"));

async function verifyWorkbook() {
  const filePath = path.resolve("Docs/TexaWave_Finance_Module_Reference.xlsx");
  console.log("Verifying generated workbook at:", filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error("Workbook file does not exist at " + filePath);
  }

  // Read with xlsx library
  const wbXlsx = xlsx.readFile(filePath);
  console.log("XLSX SheetNames:", wbXlsx.SheetNames);

  const expectedSheets = [
    "Dashboard",
    "API Endpoints",
    "Database & Schemas",
    "Manual Postman Test",
    "Glossary & Notes",
  ];

  if (wbXlsx.SheetNames.length !== 5) {
    throw new Error(
      `Expected exactly 5 sheets, found ${wbXlsx.SheetNames.length}`,
    );
  }

  expectedSheets.forEach((s) => {
    if (!wbXlsx.SheetNames.includes(s)) {
      throw new Error(`Missing expected sheet: ${s}`);
    }
  });

  // Verify rows in each sheet
  wbXlsx.SheetNames.forEach((name) => {
    const sheet = wbXlsx.Sheets[name];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet "${name}": total rows = ${json.length}`);
  });

  // Read with ExcelJS
  const wbExcelJS = new ExcelJS.Workbook();
  await wbExcelJS.xlsx.readFile(filePath);

  wbExcelJS.eachSheet((ws, id) => {
    console.log(
      `ExcelJS Sheet ${id}: ${ws.name} (Rows: ${ws.rowCount}, Cols: ${ws.columnCount})`,
    );
  });

  // Verify Manual Postman Test IDs
  const testSheet = wbXlsx.Sheets["Manual Postman Test"];
  const testData = xlsx.utils.sheet_to_json(testSheet, { header: 1 });
  const testIds = testData
    .slice(4)
    .map((r) => r[0])
    .filter(Boolean);
  console.log("Total Test IDs in Manual Postman Test:", testIds.length);

  // Check preserved IDs
  for (let i = 1; i <= 19; i++) {
    const id = `PR-${i.toString().padStart(3, "0")}`;
    if (!testIds.includes(id)) throw new Error(`Missing preserved ID: ${id}`);
  }
  for (let i = 1; i <= 10; i++) {
    const id = `EXP-${i.toString().padStart(3, "0")}`;
    if (!testIds.includes(id)) throw new Error(`Missing preserved ID: ${id}`);
  }
  for (let i = 1; i <= 15; i++) {
    const id = `CHK-${i.toString().padStart(3, "0")}`;
    if (!testIds.includes(id)) throw new Error(`Missing preserved ID: ${id}`);
  }
  console.log(
    "All 44 original test IDs (PR-001..019, EXP-001..010, CHK-001..015) successfully preserved!",
  );

  // Check new IDs
  [
    "PM-001",
    "BNK-001",
    "COA-001",
    "GL-001",
    "GST-001",
    "REP-001",
    "INT-001",
  ].forEach((id) => {
    if (!testIds.includes(id)) throw new Error(`Missing new ID: ${id}`);
  });
  console.log("New module test cases confirmed!");

  // Check API Endpoints sheet
  const apiSheet = wbXlsx.Sheets["API Endpoints"];
  const apiData = xlsx.utils.sheet_to_json(apiSheet, { header: 1 });
  const apiRows = apiData.slice(4).filter((r) => r && r[2]);
  console.log("Total endpoints documented in API Endpoints:", apiRows.length);
  if (apiRows.length !== 74) {
    throw new Error(`Expected 74 endpoints, found ${apiRows.length}`);
  }

  // Check Database & Schemas sheet
  const dbSheet = wbXlsx.Sheets["Database & Schemas"];
  const dbData = xlsx.utils.sheet_to_json(dbSheet, { header: 1 });
  const dbRows = dbData.slice(4).filter((r) => r && r[1]);
  console.log("Total entries in Database & Schemas:", dbRows.length);

  console.log("\n--- ALL VERIFICATION CHECKS PASSED PERFECTLY! ---");
}

verifyWorkbook().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
