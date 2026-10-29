const fs = require("fs");
const pdfPath = "Docs/Finance_ER_Diagrams.pdf";

const stats = fs.statSync(pdfPath);
console.log(`Verified PDF: ${pdfPath}`);
console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);

// Check PDF header
const buf = fs.readFileSync(pdfPath);
const header = buf.slice(0, 10).toString();
console.log(`PDF Header: ${header}`);

// Count pages by searching /Type /Page
const content = buf.toString("latin1");
const pageMatches = content.match(/\/Type\s*\/Page\b/g);
console.log(
  `Detected Pages in PDF: ${pageMatches ? pageMatches.length : "unknown"}`,
);
