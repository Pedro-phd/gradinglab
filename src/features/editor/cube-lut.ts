// Parser restrito de LUT 3D no formato Adobe CUBE 1.0 (docs/research/luts-log-xmp.md, seção 1).
// Só LUT 3D; tudo fora desse recorte é rejeitado em vez de aplicado errado.

const MIN_SIZE = 2;
const MAX_SIZE = 65;

// 64 bytes por linha de dados dá folga larga para uma LUT de 65 pontos (65³ linhas).
// O limite em bytes é garantido por readCubeLutFile via file.size.
export const MAX_CUBE_LUT_FILE_BYTES = MAX_SIZE ** 3 * 64;
// parseCubeLut só vê texto e mede caracteres (unidades UTF-16): cada um ocupa ao menos
// 1 byte, então um arquivo dentro do limite em bytes nunca excede este limite.
export const MAX_CUBE_LUT_CHARS = MAX_CUBE_LUT_FILE_BYTES;

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
  invalid_domain: "O domínio da LUT é inválido: o mínimo precisa ser menor que o máximo em todos os canais.",
  unsupported_keyword: "O arquivo usa uma palavra-chave do formato .cube que não é suportada.",
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
// Sem quantificadores sobrepostos (\d+ seguido de \d* só após "."), para não ter backtracking quadrático.
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
// Palavras-chave do CUBE são todas em maiúsculas; "NaN", "a" etc. caem como linha de dados inválida.
const KEYWORD = /^[A-Z_][A-Z0-9_]*$/;

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
  // Rejeita antes de dividir em linhas.
  if (text.length > MAX_CUBE_LUT_CHARS) return fail("too_large");

  let size = 0;
  let total = 0;
  let data = new Float32Array(0);
  let rows = 0;
  let domainMin: Triple = [0, 0, 0];
  let domainMax: Triple = [1, 1, 1];
  let hasMin = false;
  let hasMax = false;
  let hasInputRange = false;

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [keyword = "", ...args] = line.split(/\s+/);

    if (keyword === "LUT_1D_SIZE") return fail("unsupported_1d");
    // Palavras-chave vêm antes dos dados; depois deles o arquivo está malformado.
    if (rows > 0 && KEYWORD.test(keyword)) return fail("invalid_value");
    if (keyword === "TITLE") continue;
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
      if (keyword === "DOMAIN_MIN" ? hasMin : hasMax) return fail("invalid_value");
      if (hasInputRange) return fail("invalid_domain");
      const triple = parseTriple(args);
      if (!triple) return fail("invalid_value");
      if (keyword === "DOMAIN_MIN") [domainMin, hasMin] = [triple, true];
      else [domainMax, hasMax] = [triple, true];
      continue;
    }
    // Legado (Iridas/DaVinci Resolve): equivale a DOMAIN_MIN/MAX iguais nos três canais.
    if (keyword === "LUT_3D_INPUT_RANGE") {
      if (hasInputRange) return fail("invalid_value");
      if (hasMin || hasMax) return fail("invalid_domain");
      const [min, max] = args.map(parseNumber);
      if (args.length !== 2 || min == null || max == null || min >= max) {
        return fail("invalid_domain");
      }
      domainMin = [min, min, min];
      domainMax = [max, max, max];
      hasInputRange = true;
      continue;
    }
    if (KEYWORD.test(keyword)) return fail("unsupported_keyword");

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
  if (file.size > MAX_CUBE_LUT_FILE_BYTES) return fail("too_large");
  try {
    return parseCubeLut(await file.text());
  } catch {
    return fail("read_failed");
  }
}
