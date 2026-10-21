// Code 128 (subset B) encoder — dependency-free so SCM labels need no extra
// barcode library. Subset B covers printable ASCII (32–126), which is every
// SKU / batch / document code this ERP prints. Output is the symbol as a list of
// alternating bar / space module widths (starting with a bar), plus a helper
// that turns it into SVG rectangles.

/** Bar/space widths (b s b s b s) of symbols 0–105 and the stop pattern (106). */
const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
] as const;

const START_B = 104;
const STOP = 106;

/** True when every character can be written in Code 128 subset B. */
export function isCode128Encodable(text: string): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

/** Symbol values (start, data..., checksum, stop) for `text` in subset B. */
export function code128Values(text: string): number[] {
  const values = [START_B];
  for (let i = 0; i < text.length; i++) values.push(text.charCodeAt(i) - 32);
  let sum = START_B;
  for (let i = 1; i < values.length; i++) sum += values[i]! * i;
  values.push(sum % 103);
  values.push(STOP);
  return values;
}

/** Alternating bar / space module widths of the whole symbol (bar first). */
export function code128Widths(text: string): number[] {
  const out: number[] = [];
  for (const v of code128Values(text)) {
    for (const ch of PATTERNS[v]!) out.push(Number(ch));
  }
  return out;
}

/** The symbol as a string of "1" (bar) / "0" (space) modules. */
export function code128Modules(text: string): string {
  let bar = true;
  let out = "";
  for (const w of code128Widths(text)) {
    out += (bar ? "1" : "0").repeat(w);
    bar = !bar;
  }
  return out;
}

export interface Code128Layout {
  /** Total width in modules, including the quiet zones. */
  modules: number;
  /** Bars as [startModule, widthModules]. */
  bars: [number, number][];
}

/** Bar positions in module units with a 10-module quiet zone either side. */
export function code128Layout(text: string, quiet = 10): Code128Layout {
  const bars: [number, number][] = [];
  let x = quiet;
  let bar = true;
  for (const w of code128Widths(text)) {
    if (bar) bars.push([x, w]);
    x += w;
    bar = !bar;
  }
  return { modules: x + quiet, bars };
}
