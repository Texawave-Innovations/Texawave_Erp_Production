// Minimal QR Code generator (byte mode, error-correction level M, versions
// 1–40) — dependency-free so SCM bin/product/document labels need no extra
// QR library. Follows ISO/IEC 18004: data → Reed-Solomon blocks → interleave →
// function patterns → zig-zag placement → best of 8 masks → format/version bits.

const EC_CODEWORDS_PER_BLOCK_M = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
  26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28,
];
const NUM_EC_BLOCKS_M = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];

const MIN_VERSION = 1;
const MAX_VERSION = 40;
/** Format-information bits for level M. */
const FORMAT_BITS_M = 0;

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver: number): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    EC_CODEWORDS_PER_BLOCK_M[ver]! * NUM_EC_BLOCKS_M[ver]!
  );
}

// ---- Reed-Solomon over GF(2^8) / 0x11D ----------------------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(
  data: readonly number[],
  divisor: readonly number[],
): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i]! ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

function addEccAndInterleave(data: readonly number[], ver: number): number[] {
  const numBlocks = NUM_EC_BLOCKS_M[ver]!;
  const blockEccLen = EC_CODEWORDS_PER_BLOCK_M[ver]!;
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const rsDiv = reedSolomonDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(
      k,
      k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1),
    );
    k += dat.length;
    const ecc = reedSolomonRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // placeholder so all blocks line up
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      // Skip the placeholder byte in the short blocks.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
        result.push(block[i]!);
    });
  }
  return result;
}

// ---- matrix construction ------------------------------------------------------

class QrMatrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.drawFunctionPatterns();
  }

  private setFunction(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }

  private drawFunctionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);

    const pos = alignmentPositions(this.version, this.size);
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === n - 1) ||
          (i === n - 1 && j === 0)
        )
          continue;
        this.drawAlignment(pos[i]!, pos[j]!);
      }
    }
    this.drawFormatBits(0); // reserves the format areas
    this.drawVersion();
  }

  private drawFinder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignment(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(
          cx + dx,
          cy + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
        );
      }
    }
  }

  drawFormatBits(mask: number) {
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;

    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(i));
    this.setFunction(8, 7, bit(6));
    this.setFunction(8, 8, bit(7));
    this.setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(i));

    for (let i = 0; i < 8; i++) this.setFunction(this.size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++)
      this.setFunction(8, this.size - 15 + i, bit(i));
    this.setFunction(8, this.size - 8, true); // always dark
  }

  private drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  drawCodewords(data: readonly number[]) {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] =
              ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
        }
        if (!this.isFunction[y]![x] && invert)
          this.modules[y]![x] = !this.modules[y]![x];
      }
    }
  }

  penaltyScore(): number {
    const s = this.size;
    const m = this.modules;
    let result = 0;

    // Rule 1: runs of 5+ same-colour modules in a row / column.
    const runs = (get: (a: number, b: number) => boolean) => {
      let total = 0;
      for (let a = 0; a < s; a++) {
        let run = 1;
        for (let b = 1; b < s; b++) {
          if (get(a, b) === get(a, b - 1)) {
            run++;
            if (run === 5) total += 3;
            else if (run > 5) total++;
          } else run = 1;
        }
      }
      return total;
    };
    result += runs((a, b) => m[a]![b]!); // rows
    result += runs((a, b) => m[b]![a]!); // columns

    // Rule 2: 2x2 blocks of the same colour.
    for (let y = 0; y < s - 1; y++) {
      for (let x = 0; x < s - 1; x++) {
        const c = m[y]![x]!;
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1])
          result += 3;
      }
    }

    // Rule 3: finder-like 1:1:3:1:1 patterns with 4 light modules on a side.
    const pattern = [true, false, true, true, true, false, true];
    const finderLike = (get: (i: number) => boolean) => {
      let total = 0;
      for (let i = 0; i + 7 <= s; i++) {
        let match = true;
        for (let k = 0; k < 7 && match; k++)
          if (get(i + k) !== pattern[k]) match = false;
        if (!match) continue;
        const lightBefore = i >= 4 && [1, 2, 3, 4].every((k) => !get(i - k));
        const lightAfter =
          i + 7 + 4 <= s && [0, 1, 2, 3].every((k) => !get(i + 7 + k));
        if (lightBefore) total += 40;
        if (lightAfter) total += 40;
      }
      return total;
    };
    for (let a = 0; a < s; a++) {
      result += finderLike((i) => m[a]![i]!);
      result += finderLike((i) => m[i]![a]!);
    }

    // Rule 4: dark-module proportion deviating from 50%.
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const percent = (dark * 100) / (s * s);
    result += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return result;
  }
}

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step =
    ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step)
    result.splice(1, 0, pos);
  return result;
}

/** Encodes `text` (UTF-8, byte mode, level M) and returns the dark-module
 * matrix, row-major, with no quiet zone. */
export function encodeQr(text: string): boolean[][] {
  const bytes = utf8Bytes(text);
  let version = MIN_VERSION;
  for (; ; version++) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= getNumDataCodewords(version) * 8)
      break;
    if (version >= MAX_VERSION)
      throw new RangeError("Data too long for a QR code");
  }

  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4); // byte mode
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);

  const capacityBits = getNumDataCodewords(version) * 8;
  append(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11)
    append(pad, 8);

  const dataCodewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    dataCodewords[i >>> 3]! |= bit << (7 - (i & 7));
  });

  const allCodewords = addEccAndInterleave(dataCodewords, version);
  const qr = new QrMatrix(version);
  qr.drawCodewords(allCodewords);

  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    qr.applyMask(mask);
    qr.drawFormatBits(mask);
    const score = qr.penaltyScore();
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    qr.applyMask(mask); // undo (XOR)
  }
  qr.applyMask(bestMask);
  qr.drawFormatBits(bestMask);
  return qr.modules;
}
