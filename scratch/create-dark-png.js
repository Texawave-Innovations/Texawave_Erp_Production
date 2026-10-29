import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightPath = path.resolve(
  "apps/ui/node_modules/@playwright/test/index.js",
);
const playwrightModule = await import(pathToFileURL(playwrightPath).href);
const chromium =
  playwrightModule.default?.chromium ?? playwrightModule.chromium;

async function createDarkPng() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();

  const pngBase64 = fs
    .readFileSync("apps/ui/public/brand/texaone-logo.png")
    .toString("base64");

  const darkBase64 = await page.evaluate(async (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a > 30) {
            // Dark navy portions: r < 60, g < 60, b < 95
            // In TexaOne wordmark, letters "T", "e", "x", "a" and tagline are dark navy (#0A1A3D / #101B36)
            if (r < 55 && g < 55 && b < 90) {
              // Convert to pure white with existing antialiasing alpha
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            } else if (r < 80 && g < 90 && b < 120 && b - r > 10) {
              // Antialiased edge of dark navy text
              const luminance = (r + g + b) / 3;
              if (luminance < 90) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png").split(",")[1]);
      };
      img.src = "data:image/png;base64," + base64;
    });
  }, pngBase64);

  fs.writeFileSync(
    "apps/ui/public/brand/texaone-logo-dark.png",
    Buffer.from(darkBase64, "base64"),
  );
  console.log("Successfully generated texaone-logo-dark.png");
  await browser.close();
}

createDarkPng().catch(console.error);
