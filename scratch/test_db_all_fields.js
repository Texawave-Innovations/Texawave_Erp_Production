const fs = require("fs");

const data = JSON.parse(
  fs.readFileSync("scratch/all_model_fields.json", "utf8"),
);

console.log("=== Models & Tables ===");
for (const [m, info] of Object.entries(data)) {
  const mapAttr = info.modelAttrs.find((a) => a.startsWith("@@map("));
  const table = mapAttr ? mapAttr.match(/@@map\("([^"]+)"\)/)[1] : m;
  const scalars = info.fields.filter((f) => !f.isRelation);
  console.log(
    `${m.padEnd(35)} -> table: ${table.padEnd(30)} scalars: ${scalars.length}`,
  );
}
