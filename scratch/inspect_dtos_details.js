const fs = require("fs");

const dtos = JSON.parse(fs.readFileSync("scratch/extracted_dtos.json", "utf8"));

console.log("DTO Sample details:");
dtos.slice(0, 10).forEach((d) => {
  console.log(`\n=== DTO: ${d.name} (${d.file}) ===`);
  d.fields.forEach((f) => {
    console.log(
      `  - ${f.name}${f.isOptional ? "?" : ""}: ${f.type} | Decs: ${f.decorators.join(", ")}`,
    );
  });
});
