const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function getFiles(dir, ext) {
  let res = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        res = res.concat(getFiles(full, ext));
      } else if (item.name.endsWith(ext)) {
        res.push(full);
      }
    }
  } catch (e) {}
  return res;
}

const dtoFiles = [
  ...getFiles("apps/api/src/modules/finance", ".dto.ts"),
  ...getFiles("apps/api/src/modules/finance-settings", ".dto.ts"),
];

const schemaFiles = getFiles("apps/ui/src/features/finance", "schema.ts");

let dtos = [];

dtoFiles.forEach((file) => {
  const code = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      const name = node.name ? node.name.getText() : "Anonymous";
      const fields = [];
      node.members.forEach((m) => {
        if (ts.isPropertyDeclaration(m)) {
          const fName = m.name.getText();
          const fType = m.type ? m.type.getText() : "any";
          const isOptional = !!m.questionToken;
          const decs = (ts.getDecorators(m) || []).map((d) => d.getText());
          fields.push({
            name: fName,
            type: fType,
            isOptional,
            decorators: decs,
          });
        }
      });
      dtos.push({
        name,
        file: file.replace(/\\/g, "/"),
        fields,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
});

let zodSchemas = [];
schemaFiles.forEach((file) => {
  const code = fs.readFileSync(file, "utf8");
  const matches = [
    ...code.matchAll(
      /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{([^}]+)\}\)/gs,
    ),
  ];
  matches.forEach((m) => {
    zodSchemas.push({
      name: m[1],
      file: file.replace(/\\/g, "/"),
      snippet: m[2]
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .join(" "),
    });
  });
});

console.log("Total DTO classes found:", dtos.length);
dtos.forEach((d) =>
  console.log(`- DTO: ${d.name} (${d.fields.length} fields) in ${d.file}`),
);

console.log("\nTotal Zod schemas found:", zodSchemas.length);
zodSchemas.forEach((z) => console.log(`- Zod: ${z.name} in ${z.file}`));

fs.writeFileSync("scratch/extracted_dtos.json", JSON.stringify(dtos, null, 2));
fs.writeFileSync(
  "scratch/extracted_zod.json",
  JSON.stringify(zodSchemas, null, 2),
);
