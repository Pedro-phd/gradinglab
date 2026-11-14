// Codificador JPEG baseline (JFIF, 4:2:0) que recebe a imagem em faixas de linhas.
// Existe porque o canvas do Safari no iPhone tem limite de área (~16,7 MP): uma foto de 24 ou 48 MP
// não cabe num canvas para usar toBlob. Aqui a foto nunca existe inteira: entram faixas RGBA, saem bytes.
// Tabelas e algoritmo: ITU-T T.81 (Anexo K) e a DCT de Arai, Agui e Nakajima, como no IJG libjpeg.

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];
const LUMA_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_QUANT = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, ...new Array<number>(32).fill(99)];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
// Tabelas de Huffman padrão: quantidade de códigos por comprimento (1..16) e os símbolos.
export const HUFFMAN = {
  dcLuma: { counts: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], symbols: range(0, 11) },
  dcChroma: { counts: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], symbols: range(0, 11) },
  acLuma: {
    counts: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
    symbols: [
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    ],
  },
  acChroma: {
    counts: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
    symbols: [
      0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
      0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
      0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
      0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
      0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4,
      0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
      0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    ],
  },
};
type Table = (typeof HUFFMAN)["dcLuma"];
type Codes = { code: Int32Array; length: Int32Array };

// Códigos canônicos: crescentes dentro de cada comprimento, deslocados a cada comprimento novo.
function buildCodes({ counts, symbols }: Table): Codes {
  const code = new Int32Array(256);
  const length = new Int32Array(256);
  let next = 0;
  let index = 0;
  counts.forEach((count, bits) => {
    for (let i = 0; i < count; i += 1) {
      code[symbols[index]!] = next++;
      length[symbols[index++]!] = bits + 1;
    }
    next <<= 1;
  });
  return { code, length };
}

/** Tabela de quantização (ordem natural) para a qualidade 1..100, pela fórmula do IJG. */
export function scaleQuant(base: number[], quality: number): number[] {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = q < 50 ? 5000 / q : 200 - 2 * q;
  return base.map((value) => Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))));
}

const AAN = [1, 1.387039845, 1.306562965, 1.175875602, 1, 0.785694958, 0.5411961, 0.275899379];
// A DCT de AAN sai com um fator por linha e coluna; ele entra junto da divisão pela quantização.
function divisors(quant: number[]): Float64Array {
  return Float64Array.from({ length: 64 }, (_, k) => 1 / (quant[k]! * AAN[k >> 3]! * AAN[k & 7]! * 8));
}

function forwardDct(data: Float64Array) {
  for (let pass = 0; pass < 2; pass += 1) {
    const step = pass === 0 ? 1 : 8; // linhas, depois colunas
    for (let line = 0; line < 8; line += 1) {
      const o = pass === 0 ? line * 8 : line;
      const d0 = data[o]!, d1 = data[o + step]!, d2 = data[o + 2 * step]!, d3 = data[o + 3 * step]!;
      const d4 = data[o + 4 * step]!, d5 = data[o + 5 * step]!, d6 = data[o + 6 * step]!, d7 = data[o + 7 * step]!;
      const t0 = d0 + d7, t7 = d0 - d7, t1 = d1 + d6, t6 = d1 - d6, t2 = d2 + d5, t5 = d2 - d5, t3 = d3 + d4, t4 = d3 - d4;
      let t10 = t0 + t3;
      const t13 = t0 - t3;
      let t11 = t1 + t2;
      let t12 = t1 - t2;
      data[o] = t10 + t11;
      data[o + 4 * step] = t10 - t11;
      const z1 = (t12 + t13) * 0.707106781;
      data[o + 2 * step] = t13 + z1;
      data[o + 6 * step] = t13 - z1;
      t10 = t4 + t5;
      t11 = t5 + t6;
      t12 = t6 + t7;
      const z5 = (t10 - t12) * 0.382683433;
      const z2 = 0.5411961 * t10 + z5;
      const z4 = 1.306562965 * t12 + z5;
      const z3 = t11 * 0.707106781;
      const z11 = t7 + z3;
      const z13 = t7 - z3;
      data[o + 5 * step] = z13 + z2;
      data[o + 3 * step] = z13 - z2;
      data[o + step] = z11 + z4;
      data[o + 7 * step] = z11 - z4;
    }
  }
}

class ByteSink {
  readonly parts: Uint8Array[] = [];
  private chunk = new Uint8Array(1 << 20);
  private used = 0;
  private bits = 0;
  private count = 0;
  byte(value: number) {
    if (this.used === this.chunk.length) this.flush();
    this.chunk[this.used++] = value;
  }
  bytes(values: number[]) {
    values.forEach((value) => this.byte(value));
  }
  word(value: number) {
    this.byte(value >> 8);
    this.byte(value & 0xff);
  }
  // Dados entropia: depois de cada 0xFF vai um 0x00, para não ser lido como marcador.
  putBits(code: number, length: number) {
    this.bits = (this.bits << length) | code;
    this.count += length;
    while (this.count >= 8) {
      const value = (this.bits >> (this.count - 8)) & 0xff;
      this.byte(value);
      if (value === 0xff) this.byte(0);
      this.count -= 8;
      this.bits &= (1 << this.count) - 1;
    }
  }
  alignWithOnes() {
    if (this.count > 0) this.putBits((1 << (8 - this.count)) - 1, 8 - this.count);
  }
  flush() {
    if (this.used > 0) this.parts.push(this.chunk.slice(0, this.used));
    this.used = 0;
  }
}

export type JpegEncoder = {
  /** rgba: linhas inteiras de cima para baixo (largura × linhas × 4 bytes); qualquer quantidade por vez. */
  addRows(rgba: Uint8Array | Uint8ClampedArray, rows: number): void;
  /** Depois da última linha: devolve o arquivo em partes, prontas para new Blob(). */
  finish(): Uint8Array[];
};

export function createJpegEncoder(width: number, height: number, quality: number): JpegEncoder {
  if (!(width > 0 && height > 0 && width <= 65535 && height <= 65535)) throw new Error("Tamanho de imagem inválido para JPEG.");
  const lumaQuant = scaleQuant(LUMA_QUANT, quality);
  const chromaQuant = scaleQuant(CHROMA_QUANT, quality);
  const lumaDiv = divisors(lumaQuant);
  const chromaDiv = divisors(chromaQuant);
  const codes = { dcLuma: buildCodes(HUFFMAN.dcLuma), acLuma: buildCodes(HUFFMAN.acLuma), dcChroma: buildCodes(HUFFMAN.dcChroma), acChroma: buildCodes(HUFFMAN.acChroma) };
  const out = new ByteSink();

  // Cabeçalhos: SOI, JFIF, tabelas de quantização (em zigue-zague), quadro 4:2:0, Huffman e início da varredura.
  out.word(0xffd8);
  out.bytes([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  out.bytes([0xff, 0xdb, 0, 132, 0, ...ZIGZAG.map((k) => lumaQuant[k]!), 1, ...ZIGZAG.map((k) => chromaQuant[k]!)]);
  out.bytes([0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const tables: [number, Table][] = [[0x00, HUFFMAN.dcLuma], [0x10, HUFFMAN.acLuma], [0x01, HUFFMAN.dcChroma], [0x11, HUFFMAN.acChroma]];
  out.bytes([0xff, 0xc4]);
  out.word(2 + tables.reduce((sum, [, table]) => sum + 17 + table.symbols.length, 0));
  tables.forEach(([id, table]) => out.bytes([id, ...table.counts, ...table.symbols]));
  out.bytes([0xff, 0xda, 0, 12, 3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]);

  // Faixa de 16 linhas (uma linha de MCUs) convertida para Y, Cb e Cr já centrados em zero.
  const paddedWidth = Math.ceil(width / 16) * 16;
  const band = new Uint8Array(width * 16 * 4);
  let bandRows = 0;
  let rowsDone = 0;
  const yPlane = new Float64Array(paddedWidth * 16);
  const cbPlane = new Float64Array((paddedWidth / 2) * 8);
  const crPlane = new Float64Array((paddedWidth / 2) * 8);
  const block = new Float64Array(64);
  const zz = new Int32Array(64);
  const previousDc = [0, 0, 0];

  function encodeBlock(component: number, divisor: Float64Array, dc: Codes, ac: Codes) {
    forwardDct(block);
    for (let k = 0; k < 64; k += 1) {
      const value = block[ZIGZAG[k]!]! * divisor[ZIGZAG[k]!]!;
      zz[k] = value > 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
    }
    const put = (codesTable: Codes, symbol: number) => out.putBits(codesTable.code[symbol]!, codesTable.length[symbol]!);
    const magnitude = (value: number) => {
      const size = value === 0 ? 0 : 32 - Math.clz32(Math.abs(value));
      return { size, bits: value < 0 ? value + (1 << size) - 1 : value };
    };
    const diff = magnitude(zz[0]! - previousDc[component]!);
    previousDc[component] = zz[0]!;
    put(dc, diff.size);
    if (diff.size > 0) out.putBits(diff.bits, diff.size);
    let zeros = 0;
    for (let k = 1; k < 64; k += 1) {
      if (zz[k] === 0) {
        zeros += 1;
        continue;
      }
      while (zeros >= 16) {
        put(ac, 0xf0); // 16 zeros seguidos
        zeros -= 16;
      }
      const coefficient = magnitude(zz[k]!);
      put(ac, (zeros << 4) | coefficient.size);
      out.putBits(coefficient.bits, coefficient.size);
      zeros = 0;
    }
    if (zeros > 0) put(ac, 0x00); // fim do bloco
  }

  function loadBlock(plane: Float64Array, stride: number, x0: number, y0: number) {
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) block[y * 8 + x] = plane[(y0 + y) * stride + x0 + x]!;
  }

  // Linhas e colunas que faltam para completar 16 repetem a borda (sem preto nas bordas).
  function encodeBand() {
    const last = Math.max(0, bandRows - 1);
    for (let y = 0; y < 16; y += 1) {
      const row = Math.min(y, last) * width * 4;
      for (let x = 0; x < paddedWidth; x += 1) {
        const p = row + Math.min(x, width - 1) * 4;
        const r = band[p]!, g = band[p + 1]!, b = band[p + 2]!;
        yPlane[y * paddedWidth + x] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
        if ((x & 1) === 0 && (y & 1) === 0) {
          // Média de 2×2 para o croma (4:2:0).
          let cb = 0;
          let cr = 0;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
            const q = Math.min(y + dy, last) * width * 4 + Math.min(x + dx, width - 1) * 4;
            const rr = band[q]!, gg = band[q + 1]!, bb = band[q + 2]!;
            cb += -0.168736 * rr - 0.331264 * gg + 0.5 * bb;
            cr += 0.5 * rr - 0.418688 * gg - 0.081312 * bb;
          }
          cbPlane[(y >> 1) * (paddedWidth / 2) + (x >> 1)] = cb / 4;
          crPlane[(y >> 1) * (paddedWidth / 2) + (x >> 1)] = cr / 4;
        }
      }
    }
    for (let mx = 0; mx < paddedWidth; mx += 16) {
      for (const [bx, by] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
        loadBlock(yPlane, paddedWidth, mx + bx, by);
        encodeBlock(0, lumaDiv, codes.dcLuma, codes.acLuma);
      }
      loadBlock(cbPlane, paddedWidth / 2, mx / 2, 0);
      encodeBlock(1, chromaDiv, codes.dcChroma, codes.acChroma);
      loadBlock(crPlane, paddedWidth / 2, mx / 2, 0);
      encodeBlock(2, chromaDiv, codes.dcChroma, codes.acChroma);
    }
    bandRows = 0;
  }

  return {
    addRows(rgba, rows) {
      for (let row = 0; row < rows && rowsDone < height; row += 1) {
        band.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), bandRows * width * 4);
        bandRows += 1;
        rowsDone += 1;
        if (bandRows === 16) encodeBand();
      }
    },
    finish() {
      if (rowsDone < height) throw new Error("Faltam linhas da imagem.");
      if (bandRows > 0) encodeBand();
      out.alignWithOnes();
      out.word(0xffd9);
      out.flush();
      return out.parts;
    },
  };
}
