import { describe, expect, it } from "vitest";
import {
  MAX_CUBE_LUT_CHARS,
  MAX_CUBE_LUT_FILE_BYTES,
  parseCubeLut,
  readCubeLutFile,
  type CubeLutErrorCode,
  type CubeLutResult,
} from "./cube-lut";

const EIGHT_ROWS = [
  "0 0 0",
  "1 0 0",
  "0 1 0",
  "1 1 0",
  "0 0 1",
  "1 0 1",
  "0 1 1",
  "1 1 1",
];

function cube(header: string[], rows: string[] = EIGHT_ROWS): string {
  return [...header, ...rows].join("\n");
}

function expectError(result: CubeLutResult, code: CubeLutErrorCode) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
}

describe("parseCubeLut", () => {
  it("lê uma LUT 3D válida de 2 pontos", () => {
    const result = parseCubeLut(cube(["LUT_3D_SIZE 2"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lut.size).toBe(2);
    expect(result.lut.data).toBeInstanceOf(Float32Array);
    expect(result.lut.data.length).toBe(24);
    expect(result.lut.domainMin).toEqual([0, 0, 0]);
    expect(result.lut.domainMax).toEqual([1, 1, 1]);
  });

  it("respeita a ordem do arquivo: vermelho varia mais rápido", () => {
    const result = parseCubeLut(
      cube(["LUT_3D_SIZE 2"], [
        "0.1 0.2 0.3",
        "0.4 0.5 0.6",
        ...EIGHT_ROWS.slice(2),
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.lut.data.slice(0, 3))).toEqual(
      [0.1, 0.2, 0.3].map(Math.fround),
    );
    expect(Array.from(result.lut.data.slice(3, 6))).toEqual(
      [0.4, 0.5, 0.6].map(Math.fround),
    );
  });

  it("aceita TITLE, comentários (#), linhas em branco e CRLF", () => {
    const text = [
      "# criado por teste",
      'TITLE "Meu look"',
      "",
      "LUT_3D_SIZE 2",
      "# dados",
      ...EIGHT_ROWS,
      "",
    ].join("\r\n");
    const result = parseCubeLut(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lut.data.length).toBe(24);
  });

  it("lê DOMAIN_MIN e DOMAIN_MAX explícitos", () => {
    const result = parseCubeLut(
      cube(["LUT_3D_SIZE 2", "DOMAIN_MIN -0.5 0 0.25", "DOMAIN_MAX 2 3 4"]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lut.domainMin).toEqual([-0.5, 0, 0.25]);
    expect(result.lut.domainMax).toEqual([2, 3, 4]);
  });

  it("rejeita DOMAIN_MIN maior ou igual a DOMAIN_MAX", () => {
    expectError(
      parseCubeLut(
        cube(["LUT_3D_SIZE 2", "DOMAIN_MIN 0 0 1", "DOMAIN_MAX 1 1 1"]),
      ),
      "invalid_domain",
    );
    expectError(
      parseCubeLut(
        cube(["LUT_3D_SIZE 2", "DOMAIN_MIN 2 0 0", "DOMAIN_MAX 1 1 1"]),
      ),
      "invalid_domain",
    );
  });

  it("rejeita LUT 1D com mensagem específica", () => {
    const result = parseCubeLut(
      cube(["LUT_1D_SIZE 16"], ["0 0 0", "1 1 1"]),
    );
    expectError(result, "unsupported_1d");
    if (!result.ok) expect(result.error.message).toMatch(/1D/);
  });

  it("rejeita tamanho fora de 2..65", () => {
    for (const size of ["1", "0", "66", "2.5", "abc"]) {
      expectError(
        parseCubeLut(cube([`LUT_3D_SIZE ${size}`])),
        "unsupported_size",
      );
    }
  });

  it("aceita os limites 2 e 65", () => {
    const rows = Array.from({ length: 65 ** 3 }, () => "0 0 0");
    const result = parseCubeLut(cube(["LUT_3D_SIZE 65"], rows));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lut.data.length).toBe(65 ** 3 * 3);
  });

  it("rejeita quantidade de linhas diferente de N³", () => {
    expectError(
      parseCubeLut(cube(["LUT_3D_SIZE 2"], EIGHT_ROWS.slice(0, 7))),
      "row_count_mismatch",
    );
    expectError(
      parseCubeLut(cube(["LUT_3D_SIZE 2"], [...EIGHT_ROWS, "0 0 0"])),
      "row_count_mismatch",
    );
  });

  it("rejeita valor não numérico, NaN ou Infinity", () => {
    for (const bad of ["a b c", "NaN 0 0", "0 Infinity 0", "0 0 -Infinity", "0x1 0 0", "1e999 0 0", "0 0", "0 0 0 0"]) {
      expectError(
        parseCubeLut(cube(["LUT_3D_SIZE 2"], [bad, ...EIGHT_ROWS.slice(1)])),
        "invalid_value",
      );
    }
    expectError(
      parseCubeLut(cube(["LUT_3D_SIZE 2", "DOMAIN_MAX 1 x 1"])),
      "invalid_value",
    );
  });

  it("rejeita arquivo sem LUT_3D_SIZE (ex.: outro tipo de arquivo renomeado para .cube)", () => {
    expectError(parseCubeLut("<?xml version=\"1.0\"?>"), "missing_size");
    expectError(parseCubeLut(cube([])), "missing_size");
    expectError(parseCubeLut("TITLE \"x\"\n# nada"), "missing_size");
    expectError(parseCubeLut(""), "missing_size");
  });

  it("rejeita texto acima do limite de caracteres antes de processar", () => {
    expectError(parseCubeLut("a".repeat(MAX_CUBE_LUT_CHARS + 1)), "too_large");
  });

  it("rejeita token numérico inválido gigante sem travar (sem backtracking quadrático)", () => {
    const text = cube(["LUT_3D_SIZE 2"], [`${"1".repeat(200_000)}x 0 0`, ...EIGHT_ROWS.slice(1)]);
    const start = performance.now();
    expectError(parseCubeLut(text), "invalid_value");
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("aceita formatos decimais válidos e rejeita os inválidos", () => {
    for (const ok of ["1e-3", ".5", "5.", "-.5e+1", "+2"]) {
      const result = parseCubeLut(cube(["LUT_3D_SIZE 2"], [`${ok} 0 0`, ...EIGHT_ROWS.slice(1)]));
      expect(result.ok).toBe(true);
    }
    for (const bad of ["1e", ".", "0x1", "Infinity", "--1"]) {
      expectError(
        parseCubeLut(cube(["LUT_3D_SIZE 2"], [`${bad} 0 0`, ...EIGHT_ROWS.slice(1)])),
        "invalid_value",
      );
    }
  });

  it("lê LUT_3D_INPUT_RANGE como domínio igual nos três canais", () => {
    const result = parseCubeLut(cube(["LUT_3D_SIZE 2", "LUT_3D_INPUT_RANGE -0.5 2"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lut.domainMin).toEqual([-0.5, -0.5, -0.5]);
    expect(result.lut.domainMax).toEqual([2, 2, 2]);
  });

  it("rejeita LUT_3D_INPUT_RANGE inválido ou combinado com DOMAIN_MIN/MAX", () => {
    for (const range of ["1 1", "2 1", "0", "0 1 2", "0 x", "0 Infinity"]) {
      expectError(
        parseCubeLut(cube(["LUT_3D_SIZE 2", `LUT_3D_INPUT_RANGE ${range}`])),
        "invalid_domain",
      );
    }
    expectError(
      parseCubeLut(cube(["LUT_3D_SIZE 2", "DOMAIN_MIN 0 0 0", "LUT_3D_INPUT_RANGE 0 1"])),
      "invalid_domain",
    );
    expectError(
      parseCubeLut(cube(["LUT_3D_SIZE 2", "LUT_3D_INPUT_RANGE 0 1", "DOMAIN_MAX 1 1 1"])),
      "invalid_domain",
    );
  });

  it("rejeita palavra-chave desconhecida sem ecoar o conteúdo do arquivo", () => {
    const result = parseCubeLut(cube(["LUT_3D_SIZE 2", "LUT_IN_VIDEO_RANGE 16 235"]));
    expectError(result, "unsupported_keyword");
    if (!result.ok) expect(result.error.message).not.toMatch(/LUT_IN_VIDEO_RANGE|235/);
  });

  it("rejeita palavra-chave depois de linhas de dados", () => {
    for (const keyword of ["DOMAIN_MAX 1 1 1", "TITLE \"x\"", "LUT_3D_INPUT_RANGE 0 1"]) {
      expectError(parseCubeLut(cube(["LUT_3D_SIZE 2"], [...EIGHT_ROWS, keyword])), "invalid_value");
    }
  });

  it("rejeita DOMAIN_MIN ou DOMAIN_MAX repetido", () => {
    for (const name of ["DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"]) {
      expectError(parseCubeLut(cube(["LUT_3D_SIZE 2", name, name])), "invalid_value");
    }
  });

  it("mantém valores de tabela fora de [0,1] sem alterar", () => {
    const result = parseCubeLut(
      cube(["LUT_3D_SIZE 2"], ["1.2 -0.5 2", ...EIGHT_ROWS.slice(1)]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.lut.data.slice(0, 3))).toEqual(
      [1.2, -0.5, 2].map(Math.fround),
    );
  });

  it("cada código de erro tem mensagem em pt-BR sem stack nem caminho de arquivo", async () => {
    const valid = cube(["LUT_3D_SIZE 2"]);
    const unreadable = new File([valid], "x.cube");
    unreadable.text = () => Promise.reject(new Error("falha interna em /tmp/x.ts"));
    // Record exige um gatilho para cada código: um código novo quebra o typecheck aqui.
    const triggers: Record<CubeLutErrorCode, () => CubeLutResult | Promise<CubeLutResult>> = {
      too_large: () => parseCubeLut("a".repeat(MAX_CUBE_LUT_CHARS + 1)),
      invalid_extension: () => readCubeLutFile(new File([valid], "x.txt")),
      read_failed: () => readCubeLutFile(unreadable),
      missing_size: () => parseCubeLut(""),
      unsupported_1d: () => parseCubeLut(cube(["LUT_1D_SIZE 2"])),
      unsupported_size: () => parseCubeLut(cube(["LUT_3D_SIZE 1"])),
      invalid_domain: () =>
        parseCubeLut(cube(["LUT_3D_SIZE 2", "DOMAIN_MIN 1 1 1", "DOMAIN_MAX 0 0 0"])),
      unsupported_keyword: () => parseCubeLut(cube(["LUT_3D_SIZE 2", "LUT_IN_VIDEO_RANGE 1 2"])),
      row_count_mismatch: () => parseCubeLut(cube(["LUT_3D_SIZE 2"], [])),
      invalid_value: () => parseCubeLut(cube(["LUT_3D_SIZE 2"], ["x y z"])),
    };
    for (const [code, trigger] of Object.entries(triggers)) {
      const result = await trigger();
      expectError(result, code as CubeLutErrorCode);
      if (result.ok) continue;
      expect(result.error.message).toMatch(/(?:^|\s)(?:de|do|da|em|para|não|precisa|contém|usa)(?=[\s.:,]|$)/i);
      expect(result.error.message).not.toMatch(/\bat \w|Error|\.ts|[/\\]/);
    }
  });
});

describe("readCubeLutFile", () => {
  const valid = cube(["LUT_3D_SIZE 2"]);

  it("lê um arquivo .cube válido", async () => {
    const result = await readCubeLutFile(new File([valid], "look.CUBE"));
    expect(result.ok).toBe(true);
  });

  it("rejeita extensão diferente de .cube sem ler o conteúdo", async () => {
    const result = await readCubeLutFile(new File([valid], "look.txt"));
    expectError(result, "invalid_extension");
  });

  it("rejeita arquivo acima do limite pelo tamanho, sem ler o conteúdo", async () => {
    const big = new File([new Uint8Array(MAX_CUBE_LUT_FILE_BYTES + 1)], "big.cube");
    expectError(await readCubeLutFile(big), "too_large");
  });

  it("valida o conteúdo mesmo com extensão .cube", async () => {
    const result = await readCubeLutFile(new File(["não sou uma LUT"], "x.cube"));
    expect(result.ok).toBe(false);
  });
});
