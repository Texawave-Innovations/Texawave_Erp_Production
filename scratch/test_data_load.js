const fs = require("fs");
const path = require("path");

// Read extracted data
const allModelFields = JSON.parse(
  fs.readFileSync("scratch/all_model_fields.json", "utf8"),
);
const parsedEndpoints = JSON.parse(
  fs.readFileSync("scratch/all_parsed_endpoints.json", "utf8"),
);

console.log("Model fields loaded:", Object.keys(allModelFields).length);
console.log("Parsed endpoints loaded:", parsedEndpoints.length);
