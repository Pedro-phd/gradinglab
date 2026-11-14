import { describe, expect, it } from "vitest";
import { createJpegEncoder, HUFFMAN, scaleQuant } from "./jpeg-encoder";

function encode(width: number, height: number, pixel: (x: number, y: number) => [number, number, number], bands: number[] = [height]) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rgba.set([...pixel(x, y), 255], (y * width + x) * 4);
  const encoder = createJpegEncoder(width, height, 92);
  let row = 0;
  for (let k = 0; row < height; k += 1) {
    const rows = Math.min(bands[k % bands.length]!, height - row);
    encoder.addRows(rgba.subarray(row * width * 4, (row + rows) * width * 4), rows);
    row += rows;
  }
  const parts = encoder.finish();
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

const noise = (x: number, y: number): [number, number, number] => [(x * 97 + y * 31) % 256, (x * 13 + y * 211) % 256, (x * y) % 256];

describe("codificador JPEG em faixas", () => {
  it("as tabelas de Huffman padrão têm um símbolo para cada código declarado", () => {
    for (const table of Object.values(HUFFMAN)) {
      expect(table.counts).toHaveLength(16);
      expect(table.symbols).toHaveLength(table.counts.reduce((sum, count) => sum + count, 0));
    }
  });

  it("escreve um JPEG baseline com o tamanho certo no quadro (SOF0) e termina em EOI", () => {
    const bytes = encode(37, 21, noise);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    expect([bytes.at(-2), bytes.at(-1)]).toEqual([0xff, 0xd9]);
    const sof = bytes.findIndex((value, i) => value === 0xff && bytes[i + 1] === 0xc0);
    expect((bytes[sof + 5]! << 8) | bytes[sof + 6]!).toBe(21);
    expect((bytes[sof + 7]! << 8) | bytes[sof + 8]!).toBe(37);
  });

  it("nos dados da imagem todo 0xFF vem seguido de 0x00 (senão o leitor veria um marcador)", () => {
    const bytes = encode(64, 48, noise);
    const sos = bytes.findIndex((value, i) => value === 0xff && bytes[i + 1] === 0xda);
    const start = sos + 2 + ((bytes[sos + 2]! << 8) | bytes[sos + 3]!);
    for (let i = start; i < bytes.length - 2; i += 1) if (bytes[i] === 0xff) expect(bytes[i + 1]).toBe(0);
  });

  it("o resultado não depende de como as linhas foram divididas em faixas", () => {
    expect(encode(50, 40, noise, [40])).toEqual(encode(50, 40, noise, [3, 16, 1, 7]));
  });

  it("recusa terminar antes da última linha", () => {
    const encoder = createJpegEncoder(8, 8, 90);
    encoder.addRows(new Uint8Array(8 * 4 * 4), 4);
    expect(() => encoder.finish()).toThrow();
  });

  it("qualidade segue a fórmula do IJG: 50 mantém a tabela base, 100 vira tudo 1", () => {
    expect(scaleQuant([16, 11, 99], 50)).toEqual([16, 11, 99]);
    expect(scaleQuant([16, 11, 99], 100)).toEqual([1, 1, 1]);
    expect(scaleQuant([16, 255], 1)).toEqual([255, 255]);
  });
});
