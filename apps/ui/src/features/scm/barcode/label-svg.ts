// Pure SVG builders for SCM labels: Code 128 / EAN-13 barcodes, QR codes and
// the printable label card. The same SVG string backs the on-screen preview,
// the browser print dialog and the PNG download, so what you see is what is
// printed.

import { code128Layout, isCode128Encodable } from "./code128";
import { ean13Modules, toEan13 } from "./ean13";
import { encodeQr } from "./qr";

export type LabelFormat = "CODE128" | "EAN13" | "QR";

const INK = "#0f172a";

export const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface Fragment {
  /** SVG markup, positioned at the origin. */
  svg: string;
  width: number;
  height: number;
}

/** Linear barcode as an SVG fragment `width` wide (excluding the value text). */
function barcodeFragment(
  value: string,
  format: "CODE128" | "EAN13",
  width: number,
  height: number,
): Fragment | null {
  let bars: [number, number][];
  let modules: number;
  if (format === "EAN13") {
    const bits = ean13Modules(toEan13(value));
    bars = [];
    for (let i = 0; i < bits.length;) {
      if (bits[i] === "1") {
        let j = i;
        while (bits[j] === "1") j++;
        bars.push([i + 9, j - i]);
        i = j;
      } else i++;
    }
    modules = bits.length + 18; // 9-module quiet zones
  } else {
    if (!isCode128Encodable(value)) return null;
    const layout = code128Layout(value);
    bars = layout.bars;
    modules = layout.modules;
  }
  const unit = width / modules;
  const d = bars
    .map(
      ([x, w]) =>
        `M${(x * unit).toFixed(3)} 0h${(w * unit).toFixed(3)}v${height}h-${(w * unit).toFixed(3)}z`,
    )
    .join("");
  return { svg: `<path d="${d}" fill="${INK}"/>`, width, height };
}

/** QR code as an SVG fragment `size` px square (with a 2-module quiet zone). */
function qrFragment(value: string, size: number): Fragment {
  const matrix = encodeQr(value || " ");
  const n = matrix.length;
  const quiet = 2;
  const unit = size / (n + quiet * 2);
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n;) {
      if (matrix[y]![x]) {
        let run = x;
        while (run < n && matrix[y]![run]) run++;
        d += `M${((x + quiet) * unit).toFixed(3)} ${((y + quiet) * unit).toFixed(3)}h${((run - x) * unit).toFixed(3)}v${unit.toFixed(3)}h-${((run - x) * unit).toFixed(3)}z`;
        x = run;
      } else x++;
    }
  }
  return { svg: `<path d="${d}" fill="${INK}"/>`, width: size, height: size };
}

/** A bare QR code as a standalone <svg> string. */
export function qrSvg(value: string, size = 120): string {
  const f = qrFragment(value, size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR code ${xmlEscape(value)}">${f.svg}</svg>`;
}

/** A bare linear barcode as a standalone <svg> string (empty if unencodable). */
export function barcodeSvg(
  value: string,
  format: "CODE128" | "EAN13" = "CODE128",
  width = 240,
  height = 60,
): string {
  const f = barcodeFragment(value, format, width, height);
  if (!f) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Barcode ${xmlEscape(value)}">${f.svg}</svg>`;
}

/** Greedy word wrap for SVG text (monospace-ish estimate, `max` chars/line). */
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  // A single very long token (a document number) is split to fit.
  return lines.flatMap((l) =>
    l.length <= max ? [l] : (l.match(new RegExp(`.{1,${max}}`, "g")) ?? [l]),
  );
}

export interface LabelOptions {
  format: LabelFormat;
  value: string;
  title: string;
  subtitle?: string | undefined;
  lines?: readonly string[] | undefined;
  footer?: string | undefined;
  /** Extra QR under a linear barcode (e.g. a URL a phone camera opens). */
  secondaryQr?: string | undefined;
  secondaryQrLabel?: string | undefined;
  brand?: string | undefined;
}

/** The whole label as one self-contained <svg> (320px wide). */
export function buildLabelSvg(o: LabelOptions): {
  svg: string;
  width: number;
  height: number;
} {
  const W = 320;
  const PAD = 16;
  const inner = W - PAD * 2;
  const parts: string[] = [];
  let y = 0;
  const text = (
    s: string,
    size: number,
    opts: { weight?: number; fill?: string; mono?: boolean; gap?: number } = {},
  ) => {
    y += size + (opts.gap ?? 4);
    parts.push(
      `<text x="${W / 2}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${opts.weight ?? 400}" fill="${opts.fill ?? INK}" font-family="${opts.mono ? "ui-monospace, Menlo, Consolas, monospace" : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"}">${xmlEscape(s)}</text>`,
    );
  };

  y = PAD - 4;
  text(o.brand ?? "TEXAWAVE ERP", 10, { weight: 700, fill: "#0a3271", gap: 2 });
  for (const l of wrap(o.title, 30)) text(l, 14, { weight: 600, gap: 3 });
  if (o.subtitle)
    for (const l of wrap(o.subtitle, 44))
      text(l, 11, { fill: "#64748b", gap: 2 });
  for (const l of o.lines ?? [])
    for (const w of wrap(l, 48)) text(w, 10.5, { fill: "#64748b", gap: 2 });

  y += 12;
  if (o.format === "QR") {
    const f = qrFragment(o.value, 132);
    parts.push(
      `<g transform="translate(${(W - f.width) / 2} ${y})">${f.svg}</g>`,
    );
    y += f.height;
  } else {
    const f = barcodeFragment(o.value, o.format, inner, 62);
    if (f) {
      parts.push(`<g transform="translate(${PAD} ${y})">${f.svg}</g>`);
      y += f.height;
      text(o.format === "EAN13" ? toEan13(o.value) : o.value, 12, {
        mono: true,
        gap: 4,
      });
    } else {
      text(o.value, 12, { mono: true, gap: 4 });
    }
    if (o.secondaryQr) {
      y += 10;
      parts.push(
        `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#e2e8f0"/>`,
      );
      y += 10;
      // ~37 modules at level M need >= 120px to stay scannable once printed.
      const q = qrFragment(o.secondaryQr, 120);
      parts.push(
        `<g transform="translate(${(W - q.width) / 2} ${y})">${q.svg}</g>`,
      );
      y += q.height;
      text(o.secondaryQrLabel ?? "Scan for full product details", 10, {
        fill: "#64748b",
        gap: 4,
      });
    }
  }
  if (o.footer) {
    y += 10;
    parts.push(
      `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#e2e8f0"/>`,
    );
    y += 4;
    for (const l of wrap(o.footer, 48))
      text(l, 10.5, { fill: "#64748b", gap: 2 });
  }
  const H = y + PAD;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="#ffffff" stroke="#e2e8f0"/>${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}

/** Rasterises an SVG string to a PNG blob at `scale`x (browser only). */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 3,
): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the label"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not create the image")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Opens the browser print dialog for one or more label SVGs. */
export function printLabels(svgs: readonly string[], title: string): void {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${xmlEscape(title)}</title><style>
      @page { margin: 8mm; }
      body { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
      svg { break-inside: avoid; }
    </style></head><body>${svgs.join("")}</body></html>`,
  );
  w.document.close();
  w.focus();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    w.print();
  };
  w.onload = doPrint;
  // Some browsers do not fire onload for document.write content.
  setTimeout(() => {
    try {
      doPrint();
    } catch {
      /* window already closed */
    }
  }, 400);
}
