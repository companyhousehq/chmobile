/**
 * Pure ISO/IEC 18004 QR Code encoder (Byte mode, ECC Level M, Versions 1-14,
 * up to 362 UTF-8 bytes, ample for any otpauth://totp/ URI).
 *
 * Keeps TOTP secrets strictly local: zero network calls, zero third-party QR
 * image URLs, zero external runtime dependencies.
 */

export interface QrMatrix {
  version: number;
  size: number;
  /** Row-major boolean modules (true = dark). */
  modules: boolean[];
}

// [totalCodewords, ecCodewordsPerBlock, numBlocks] for ECC Level M, Versions 1..14
const ECC_M_TABLE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], // unused index 0
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
  [196, 18, 4],
  [242, 22, 4],
  [292, 22, 5],
  [346, 26, 5],
  [404, 30, 5],
  [466, 22, 8],
  [532, 22, 9],
  [581, 24, 9],
];

// ECC Level M format indicator bits (ISO/IEC 18004 Table 12): L=01, M=00, Q=11, H=10
const ECC_M_FORMAT_BITS = 0b00;

function dataCapacityBytes(version: number): number {
  const [total, ecPerBlock, blocks] = ECC_M_TABLE[version]!;
  return total - ecPerBlock * blocks;
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): Uint8Array {
  const res = new Uint8Array(degree);
  res[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      res[j] = gfMul(res[j]!, root);
      if (j + 1 < degree) res[j]! ^= res[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return res;
}

function rsRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const res = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ res[0]!;
    res.copyWithin(0, 1);
    res[res.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      res[i]! ^= gfMul(divisor[i]!, factor);
    }
  }
  return res;
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const res = [6];
  for (let pos = version * 4 + 10; res.length < numAlign; pos -= step) {
    res.splice(1, 0, pos);
  }
  return res;
}

function encodeDataCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const capBytes = dataCapacityBytes(version);
  const capBits = capBytes * 8;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Byte mode indicator (0100) + character count (8 bits for v1..9, 16 bits for v10..14)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  // Terminator (up to 4 zero bits) + byte alignment
  const term = Math.min(4, capBits - bits.length);
  pushBits(0, term);
  const padZero = (8 - (bits.length % 8)) % 8;
  pushBits(0, padZero);

  // Alternating pad bytes 0xEC, 0x11
  for (let padByte = 0xec; bits.length < capBits; padByte ^= 0xec ^ 0x11) {
    pushBits(padByte, 8);
  }

  const out = new Uint8Array(capBytes);
  for (let i = 0; i < bits.length; i++) {
    out[i >>> 3]! |= bits[i]! << (7 - (i & 7));
  }
  return out;
}

function interleaveBlocks(data: Uint8Array, version: number): Uint8Array {
  const [totalCodewords, ecLen, numBlocks] = ECC_M_TABLE[version]!;
  const shortBlocks = numBlocks - (totalCodewords % numBlocks);
  const shortBlockLen = Math.floor(totalCodewords / numBlocks);
  const shortDataLen = shortBlockLen - ecLen;
  const divisor = rsDivisor(ecLen);

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortDataLen + (i < shortBlocks ? 0 : 1);
    const blk = data.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, divisor));
  }

  const out = new Uint8Array(totalCodewords);
  let k = 0;
  const maxDataLen = shortDataLen + (shortBlocks < numBlocks ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b]!.length) out[k++] = dataBlocks[b]![i]!;
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      out[k++] = ecBlocks[b]![i]!;
    }
  }
  return out;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function drawFormatBits(modules: boolean[], isFunc: boolean[], size: number, mask: number): void {
  const data = (ECC_M_FORMAT_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  const set = (x: number, y: number, dark: boolean) => {
    modules[y * size + x] = dark;
    isFunc[y * size + x] = true;
  };

  for (let i = 0; i <= 5; i++) set(8, i, ((bits >>> i) & 1) !== 0);
  set(8, 7, ((bits >>> 6) & 1) !== 0);
  set(8, 8, ((bits >>> 7) & 1) !== 0);
  set(7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) set(14 - i, 8, ((bits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, ((bits >>> i) & 1) !== 0);
  set(8, size - 8, true); // fixed dark module
}

function drawVersionBits(
  modules: boolean[],
  isFunc: boolean[],
  size: number,
  version: number,
): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[b * size + a] = dark;
    isFunc[b * size + a] = true;
    modules[a * size + b] = dark;
    isFunc[a * size + b] = true;
  }
}

function penaltyScore(modules: boolean[], size: number): number {
  let score = 0;
  const at = (x: number, y: number) => modules[y * size + x];

  // Rule 1: runs of 5+ same color in rows and columns
  for (let y = 0; y < size; y++) {
    let runColor = at(0, y);
    let runLen = 1;
    for (let x = 1; x < size; x++) {
      if (at(x, y) === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = !runColor;
        runLen = 1;
      }
    }
  }
  for (let x = 0; x < size; x++) {
    let runColor = at(x, 0);
    let runLen = 1;
    for (let y = 1; y < size; y++) {
      if (at(x, y) === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = !runColor;
        runLen = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of same color
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3;
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns
  const matchPattern = (get: (i: number) => boolean) => {
    for (let i = 0; i <= size - 11; i++) {
      const a =
        get(i) &&
        !get(i + 1) &&
        get(i + 2) &&
        get(i + 3) &&
        get(i + 4) &&
        !get(i + 5) &&
        get(i + 6) &&
        !get(i + 7) &&
        !get(i + 8) &&
        !get(i + 9) &&
        !get(i + 10);
      const b =
        !get(i) &&
        !get(i + 1) &&
        !get(i + 2) &&
        !get(i + 3) &&
        get(i + 4) &&
        !get(i + 5) &&
        get(i + 6) &&
        get(i + 7) &&
        get(i + 8) &&
        !get(i + 9) &&
        get(i + 10);
      if (a || b) score += 40;
    }
  };
  for (let y = 0; y < size; y++) matchPattern((x) => at(x, y) === true);
  for (let x = 0; x < size; x++) matchPattern((y) => at(x, y) === true);

  // Rule 4: balance of dark modules
  let dark = 0;
  for (const m of modules) if (m) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;

  return score;
}

/** Encodes a UTF-8 string into an ISO/IEC 18004 QR Code matrix (ECC Level M). */
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v < ECC_M_TABLE.length; v++) {
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    if (headerBits + bytes.length * 8 <= dataCapacityBytes(v) * 8) {
      version = v;
      break;
    }
  }
  if (version === 0) {
    throw new Error(`QR payload too long (${bytes.length} bytes)`);
  }

  const size = version * 4 + 17;
  const base = new Array<boolean>(size * size).fill(false);
  const isFunc = new Array<boolean>(size * size).fill(false);
  const setFunc = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    base[y * size + x] = dark;
    isFunc[y * size + x] = true;
  };

  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Three 7x7 finder patterns + 1-module white separators
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunc(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Alignment patterns
  const align = alignmentPositions(version);
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const skip =
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0);
      if (skip) continue;
      const cx = align[i]!;
      const cy = align[j]!;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunc(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserve format & version areas before placing data bits
  drawFormatBits(base, isFunc, size, 0);
  drawVersionBits(base, isFunc, size, version);

  // Place interleaved codewords in right-to-left 2-column zig-zag
  const codewords = interleaveBlocks(encodeDataCodewords(bytes, version), version);
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (isFunc[y * size + x]) continue;
        let dark = false;
        if (bitIdx < codewords.length * 8) {
          dark = ((codewords[bitIdx >>> 3]! >>> (7 - (bitIdx & 7))) & 1) !== 0;
          bitIdx++;
        }
        base[y * size + x] = dark;
      }
    }
  }

  // Pick the optimal mask (0..7)
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestModules = base;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.slice();
    const funcCopy = isFunc.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y * size + x] && maskBit(mask, x, y)) {
          candidate[y * size + x] = !candidate[y * size + x];
        }
      }
    }
    drawFormatBits(candidate, funcCopy, size, mask);
    const p = penaltyScore(candidate, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  void bestMask;
  return { version, size, modules: bestModules };
}
