const fs = require("fs");

for (let i = 1; i <= 9; i++) {
  const svg = fs.readFileSync(`scratch/ER${i}.svg`, "utf8");
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const widthMatch = svg.match(/width="([^"]+)"/);
  const heightMatch = svg.match(/height="([^"]+)"/);
  console.log(
    `ER${i}: width=${widthMatch ? widthMatch[1] : "none"}, height=${heightMatch ? heightMatch[1] : "none"}, viewBox=${viewBoxMatch ? viewBoxMatch[1] : "none"}`,
  );
}
