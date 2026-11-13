import { describe, expect, it } from "vitest";
import {
  MAX_CUBE_LUT_BYTES,
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

  it("rejeita texto acima do limite de bytes antes de processar", () => {
    expectError(parseCubeLut("a".repeat(MAX_CUBE_LUT_BYTES + 1)), "too_large");
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

  it("cada código de erro tem mensagem em pt-BR sem stack nem caminho de arquivo", () => {
    const failures = [
      parseCubeLut("a".repeat(MAX_CUBE_LUT_BYTES + 1)),
      parseCubeLut(""),
      parseCubeLut(cube(["LUT_1D_SIZE 2"])),
      parseCubeLut(cube(["LUT_3D_SIZE 1"])),
      parseCubeLut(cube(["LUT_3D_SIZE 2"], [])),
      parseCubeLut(cube(["LUT_3D_SIZE 2"], ["x y z"])),
      parseCubeLut(
        cube(["LUT_3D_SIZE 2", "DOMAIN_MIN 1 1 1", "DOMAIN_MAX 0 0 0"]),
      ),
    ];
    const codes = new Set<string>();
    for (const result of failures) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      codes.add(result.error.code);
      expect(result.error.message).toMatch(/\b(de|do|da|em|para|não|precisa|contém)\b/);
      expect(result.error.message).not.toMatch(/\bat \w|Error|\.ts|[/\\]/);
    }
    expect(codes.size).toBe(failures.length);
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
    const big = new File([new Uint8Array(MAX_CUBE_LUT_BYTES + 1)], "big.cube");
    expectError(await readCubeLutFile(big), "too_large");
  });

  it("valida o conteúdo mesmo com extensão .cube", async () => {
    const result = await readCubeLutFile(new File(["não sou uma LUT"], "x.cube"));
    expect(result.ok).toBe(false);
  });
});
