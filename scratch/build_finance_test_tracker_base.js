const fs = require("fs");
const path = require("path");
const ExcelJS = require("../apps/ui/node_modules/exceljs");

async function createFinanceTracker() {
  console.log("=== Building TexaWave ERP Finance Full Test Tracker ===");

  const wb = new ExcelJS.Workbook();
  wb.creator = "TexaWave ERP QA & Engineering Team";
  wb.lastModifiedBy = "TexaWave ERP Automated Test Framework";
  wb.created = new Date("2026-10-29T10:00:00Z");
  wb.modified = new Date("2026-10-29T10:00:00Z");

  // Styling Constants (Strict TexaWave Brand Rules from AGENTS.md: No violet/purple, Nunito/Arial font)
  const FONT_FAMILY = "Arial";
  const COLOR_NAVY_DARK = "0A2540";
  const COLOR_BRAND_BLUE = "1769F5";
  const COLOR_HEADER_BG = "0E3A70";
  const COLOR_SUBHEADER_BG = "F1F5F9";
  const COLOR_BORDER = "CBD5E1";

  // Status Styling
  const STATUS_STYLES = {
    Completed: { fill: "D1FAE5", font: "065F46" }, // soft green
    PASS: { fill: "D1FAE5", font: "065F46" },
    "In Progress": { fill: "DBEAFE", font: "1E40AF" }, // soft blue
    Pending: { fill: "F1F5F9", font: "475569" }, // soft gray
    Blocked: { fill: "FEF3C7", font: "92400E" }, // soft amber
    "Need to Discuss": { fill: "FEE2E2", font: "991B1B" }, // soft red
    FAIL: { fill: "FEE2E2", font: "991B1B" },
  };

  const thinBorder = {
    top: { style: "thin", color: { argb: COLOR_BORDER } },
    left: { style: "thin", color: { argb: COLOR_BORDER } },
    bottom: { style: "thin", color: { argb: COLOR_BORDER } },
    right: { style: "thin", color: { argb: COLOR_BORDER } },
  };

  // Helper to style banners
  function addSheetBanner(ws, title, subtitle, maxCol = 12) {
    ws.mergeCells(1, 1, 1, maxCol);
    const r1 = ws.getCell(1, 1);
    r1.value = "  " + title;
    r1.font = {
      name: FONT_FAMILY,
      size: 14,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    r1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_BG },
    };
    r1.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(1).height = 36;

    ws.mergeCells(2, 1, 2, maxCol);
    const r2 = ws.getCell(2, 1);
    r2.value = "  " + subtitle + "  |  As of 29-Oct-26";
    r2.font = {
      name: FONT_FAMILY,
      size: 10,
      italic: true,
      color: { argb: "E2E8F0" },
    };
    r2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_NAVY_DARK },
    };
    r2.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(2).height = 24;

    ws.getRow(3).height = 10;
  }

  // Helper to add table header row
  function addTableHeader(ws, rowNumber, headers) {
    const row = ws.getRow(rowNumber);
    row.height = 28;
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = h;
      cell.font = {
        name: FONT_FAMILY,
        size: 10,
        bold: true,
        color: { argb: "FFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_HEADER_BG },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          idx === 0 || idx === 1 || idx === 7 || idx === 8 ? "center" : "left",
        wrapText: true,
      };
      cell.border = thinBorder;
    });
  }

  // Helper to add test rows
  function addTestRows(ws, startRow, testData) {
    testData.forEach((t, i) => {
      const rowIdx = startRow + i;
      const row = ws.getRow(rowIdx);
      row.height = 32;

      row.getCell(1).value = t.id;
      row.getCell(2).value = t.method;
      row.getCell(3).value = t.route;
      row.getCell(4).value = t.payload;
      row.getCell(5).value = t.expected;
      row.getCell(6).value = t.steps;
      row.getCell(7).value = t.prereqs;
      row.getCell(8).value = t.status;

      // Col 9: % Done Formula
      row.getCell(9).value = {
        formula: `IF(OR(H${rowIdx}="Completed",H${rowIdx}="PASS"),1,IF(H${rowIdx}="In Progress",0.5,0))`,
        result:
          t.status === "Completed" || t.status === "PASS"
            ? 1
            : t.status === "In Progress"
              ? 0.5
              : 0,
      };

      row.getCell(10).value = t.actual || "";
      row.getCell(11).value = t.defect || "None";
      row.getCell(12).value = t.updated || "2026-10-29";

      // Formatting
      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.font = { name: FONT_FAMILY, size: 9 };
        cell.border = thinBorder;
        cell.alignment = {
          vertical: "middle",
          horizontal:
            c === 1 || c === 2 || c === 8 || c === 9 || c === 11 || c === 12
              ? "center"
              : "left",
          wrapText: true,
        };
        // Alternating zebra fill
        if (i % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F8FAFC" },
          };
        }
      }

      // Status Cell Styling
      const st = STATUS_STYLES[t.status] || STATUS_STYLES.Pending;
      row.getCell(8).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: st.fill },
      };
      row.getCell(8).font = {
        name: FONT_FAMILY,
        size: 9,
        bold: true,
        color: { argb: st.font },
      };

      // % Done styling
      row.getCell(9).numFmt = "0%";
    });

    // Set Column Widths
    ws.columns = [
      { width: 14 }, // Test ID
      { width: 12 }, // Method
      { width: 34 }, // URL / Route
      { width: 36 }, // Payload / Action
      { width: 38 }, // Expected Result
      { width: 38 }, // Steps
      { width: 28 }, // Prerequisites
      { width: 16 }, // Status
      { width: 12 }, // % Done
      { width: 40 }, // Actual Result / Evidence
      { width: 16 }, // Defect Ref
      { width: 14 }, // Last Updated
    ];
  }

  return {
    wb,
    addSheetBanner,
    addTableHeader,
    addTestRows,
    STATUS_STYLES,
    thinBorder,
    FONT_FAMILY,
    COLOR_HEADER_BG,
    COLOR_NAVY_DARK,
    COLOR_BRAND_BLUE,
  };
}

module.exports = { createFinanceTracker };
