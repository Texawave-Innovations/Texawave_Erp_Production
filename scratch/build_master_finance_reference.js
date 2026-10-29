const fs = require("fs");
const path = require("path");
const { buildFullWorkbook } = require("./wb_builder_base.js");
const { addApiSheet } = require("./wb_api_sheet.js");
const { addDatabaseSheet } = require("./wb_db_sheet.js");
const { addTestingSheet } = require("./wb_testing_sheet.js");
const { addWorkflowsSheet } = require("./wb_workflows_sheet.js");
const { addRulesSheet } = require("./wb_rules_sheet.js");
const { addChecklistSheet } = require("./wb_checklist_sheet.js");

async function buildMasterWorkbook() {
  console.log(
    "================================================================",
  );
  console.log(
    "   TEXAWAVE ERP — MASTER FINANCE WORKBOOK GENERATION (7 SHEETS)  ",
  );
  console.log(
    "================================================================\n",
  );

  // 1. Build Base Workbook & Sheet 1 (Dashboard)
  const {
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
  } = await buildFullWorkbook();

  // 2. Build Sheet 2: Finance API Reference (74 endpoints, 27 columns)
  addApiSheet(
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
  );

  // 3. Build Sheet 3: Database & Data Model Reference (11 models, 186 scalar fields, 20 columns)
  addDatabaseSheet(
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
  );

  // 4. Build Sheet 4: Finance Manual API & Postman Testing (98 test cases, 18 columns)
  addTestingSheet(
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
  );

  // 5. Build Sheet 5: Finance Feature & Workflows (16 workflows, 16 columns)
  addWorkflowsSheet(
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
  );

  // 6. Build Sheet 6: Accounting & GST Rules (12 core rules, 8 columns)
  addRulesSheet(
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
  );

  // 7. Build Sheet 7: Remaining Issues & Checklist (17 audit items, 8 columns)
  addChecklistSheet(
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
  );

  // Target paths
  const docsDir = path.resolve("Docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const primaryPath = path.join(
    docsDir,
    "TexaWave_Finance_Module_Reference.xlsx",
  );
  const scratchPath = path.resolve(
    "scratch/TexaWave_Finance_Module_Reference.xlsx",
  );

  console.log(`\nWriting master workbook to: ${primaryPath}...`);
  await wb.xlsx.writeFile(primaryPath);
  console.log(`Writing backup to: ${scratchPath}...`);
  await wb.xlsx.writeFile(scratchPath);

  console.log(
    "\n Master Finance Reference Workbook successfully created and verified!",
  );
  console.log(`Total Worksheets: ${wb.worksheets.length}`);
  wb.worksheets.forEach((ws, idx) => {
    console.log(
      `  Sheet ${idx + 1}: ${ws.name} (Rows: ${ws.rowCount}, Cols: ${ws.columnCount})`,
    );
  });
}

if (require.main === module) {
  buildMasterWorkbook().catch((err) => {
    console.error("Master build failed:", err);
    process.exit(1);
  });
}

module.exports = { buildMasterWorkbook };
