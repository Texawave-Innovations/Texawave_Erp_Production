const fs = require("fs");
const path = require("path");

const collPath = path.resolve("postman/finance-api.postman_collection.json");
const envPath = path.resolve("postman/finance-local.postman_environment.json");

const coll = JSON.parse(fs.readFileSync(collPath, "utf-8"));
const env = JSON.parse(fs.readFileSync(envPath, "utf-8"));

console.log("Collection Name:", coll.info?.name);
console.log("Environment Name:", env.name);
console.log("Environment Values:");
for (const val of env.values || []) {
  console.log(`  ${val.key} = ${val.value} (${val.type || "default"})`);
}

function extractItems(items, parentName = "") {
  const result = [];
  for (const item of items) {
    if (item.item) {
      result.push(
        ...extractItems(
          item.item,
          parentName ? `${parentName} > ${item.name}` : item.name,
        ),
      );
    } else {
      result.push({
        folder: parentName,
        name: item.name,
        method: item.request?.method,
        url:
          item.request?.url?.raw ||
          (typeof item.request?.url === "string" ? item.request?.url : ""),
        hasEvents: Boolean(item.event && item.event.length),
        events: item.event?.map((e) => e.listen),
      });
    }
  }
  return result;
}

const allRequests = extractItems(coll.item || []);
console.log(`\nTotal Requests in Collection: ${allRequests.length}`);
allRequests.forEach((req, idx) => {
  console.log(
    `${idx + 1}. [${req.method}] ${req.folder ? `(${req.folder}) ` : ""}${req.name}`,
  );
  console.log(`   URL: ${req.url}`);
});
