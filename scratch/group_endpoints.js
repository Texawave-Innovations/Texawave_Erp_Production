const fs = require("fs");

const endpoints = JSON.parse(
  fs.readFileSync("scratch/all_parsed_endpoints.json", "utf8"),
);
const dtos = JSON.parse(fs.readFileSync("scratch/extracted_dtos.json", "utf8"));

// Build lookup of DTO fields
const dtoMap = {};
dtos.forEach((d) => {
  dtoMap[d.name] = d;
});

// Group endpoints by module
const moduleMap = {
  Expenses: [],
  "Payments Received": [],
  "Payments Made": [],
  "Treasury & Banking": [],
  "Chart of Accounts": [],
  "General Ledger & Journal Entries": [],
  "GST Registry & Returns": [],
  "Financial Reports": [],
  "Sales & Purchases Integration": [],
  "Finance Settings": [],
};

endpoints.forEach((e) => {
  let mod = "Finance Settings";
  if (e.endpoint.startsWith("/finance/expenses")) mod = "Expenses";
  else if (e.endpoint.startsWith("/finance/payments-received"))
    mod = "Payments Received";
  else if (e.endpoint.startsWith("/finance/payments-made"))
    mod = "Payments Made";
  else if (e.endpoint.startsWith("/finance/bank-")) mod = "Treasury & Banking";
  else if (e.endpoint.startsWith("/finance/accounts"))
    mod = "Chart of Accounts";
  else if (e.endpoint.startsWith("/finance/journal-entries"))
    mod = "General Ledger & Journal Entries";
  else if (e.endpoint.startsWith("/finance/gst"))
    mod = "GST Registry & Returns";
  else if (e.endpoint.startsWith("/finance/reports")) mod = "Financial Reports";
  else if (e.endpoint.startsWith("/finance/integration"))
    mod = "Sales & Purchases Integration";
  else if (e.endpoint.startsWith("/finance-settings")) mod = "Finance Settings";

  e.module = mod;
  if (moduleMap[mod]) moduleMap[mod].push(e);
});

console.log("Endpoints count per module:");
for (const [m, list] of Object.entries(moduleMap)) {
  console.log(`- ${m}: ${list.length} endpoints`);
}
