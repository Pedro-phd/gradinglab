// Parser restrito de LUT 3D no formato Adobe CUBE 1.0 (docs/research/luts-log-xmp.md, seção 1).
// Só LUT 3D; tudo fora desse recorte é rejeitado em vez de aplicado errado.

const MIN_SIZE = 2;
const MAX_SIZE = 65;

// 64 bytes por linha de dados dá folga larga para uma LUT de 65 pontos (65³ linhas).
export const MAX_CUBE_LUT_BYTES = MAX_SIZE ** 3 * 64;

type Triple = [number, number, number];

export type CubeLut = {
  size: number;
  domainMin: Triple;
  domainMax: Triple;
  /** size³ × 3 valores RGB, na ordem do arquivo (vermelho varia mais rápido). Sem clamp. */
  data: Float32Array;
};

const ERROR_MESSAGES = {
  too_large: "O arquivo é grande demais para ser uma LUT .cube suportada.",
  invalid_extension: "O arquivo precisa ter a extensão .cube.",
  read_failed: "Não foi possível ler o arquivo.",
  missing_size: "O arquivo não é uma LUT 3D .cube: falta a linha LUT_3D_SIZE.",
  unsupported_1d: "LUTs 1D (LUT_1D_SIZE) não são suportadas. Use uma LUT 3D.",
  unsupported_size: `O tamanho da LUT 3D precisa ser um inteiro de ${MIN_SIZE} a ${MAX_SIZE}.`,
  invalid_domain: "DOMAIN_MIN precisa ser menor que DOMAIN_MAX em todos os canais.",
  row_count_mismatch: "A quantidade de linhas de dados do arquivo não corresponde ao tamanho da LUT (N³).",
  invalid_value: "O arquivo contém uma linha ou valor inválido na LUT.",
} as const;

export type CubeLutErrorCode = keyof typeof ERROR_MESSAGES;

export type CubeLutResult =
  | { ok: true; lut: CubeLut }
  | { ok: false; error: { code: CubeLutErrorCode; message: string } };

function fail(code: CubeLutErrorCode): CubeLutResult {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

// Number() aceitaria "0x10" e "Infinity"; aqui só decimal finito.
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function parseNumber(token: string): number | null {
  if (!DECIMAL.test(token)) return null;
  const value = Math.fround(Number(token));
  return Number.isFinite(value) ? value : null;
}

function parseTriple(tokens: string[]): Triple | null {
  if (tokens.length !== 3) return null;
  const values = tokens.map(parseNumber);
  return values.every((v) => v !== null) ? (values as Triple) : null;
}

export function parseCubeLut(text: string): CubeLutResult {
  // Cada code unit vale ao menos 1 byte; rejeita antes de dividir em linhas.
  if (text.length > MAX_CUBE_LUT_BYTES) return fail("too_large");

  let size = 0;
  let total = 0;
  let data = new Float32Array(0);
  let rows = 0;
  let domainMin: Triple = [0, 0, 0];
  let domainMax: Triple = [1, 1, 1];

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [keyword = "", ...args] = line.split(/\s+/);

    if (keyword === "TITLE") continue;
    if (keyword === "LUT_1D_SIZE") return fail("unsupported_1d");
    if (keyword === "LUT_3D_SIZE") {
      if (size !== 0) return fail("invalid_value");
      const n = args.length === 1 && /^\d+$/.test(args[0]!) ? Number(args[0]) : 0;
      if (n < MIN_SIZE || n > MAX_SIZE) return fail("unsupported_size");
      size = n;
      total = n ** 3;
      data = new Float32Array(total * 3);
      continue;
    }
    if (keyword === "DOMAIN_MIN" || keyword === "DOMAIN_MAX") {
      const triple = parseTriple(args);
      if (!triple) return fail("invalid_value");
      if (keyword === "DOMAIN_MIN") domainMin = triple;
      else domainMax = triple;
      continue;
    }

    // Linha de dados. Sem LUT_3D_SIZE antes dela, não é um .cube que sabemos ler.
    if (size === 0) return fail("missing_size");
    const rgb = parseTriple([keyword, ...args]);
    if (!rgb) return fail("invalid_value");
    if (rows === total) return fail("row_count_mismatch");
    data.set(rgb, rows * 3);
    rows++;
  }

  if (size === 0) return fail("missing_size");
  if (rows !== total) return fail("row_count_mismatch");
  if (domainMin.some((min, i) => min >= domainMax[i]!)) return fail("invalid_domain");

  return { ok: true, lut: { size, domainMin, domainMax, data } };
}

/** Confere extensão e tamanho antes de ler; o conteúdo decide a validade. */
export async function readCubeLutFile(file: File): Promise<CubeLutResult> {
  if (!file.name.toLowerCase().endsWith(".cube")) return fail("invalid_extension");
  if (file.size > MAX_CUBE_LUT_BYTES) return fail("too_large");
  try {
    return parseCubeLut(await file.text());
  } catch {
    return fail("read_failed");
  }
}
