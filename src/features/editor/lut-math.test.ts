import { describe, expect, it } from "vitest";
import type { CubeLut } from "./cube-lut";
import { clampIntensity, lutTexture, mixIntensity, normalizeInput } from "./lut-math";

describe("mistura de intensidade", () => {
  const base: [number, number, number] = [0.2, 0.4, 0.6];
  const look: [number, number, number] = [0.9, 0.1, 0.5];

  it("0% devolve exatamente a base", () => {
    expect(mixIntensity(base, look, 0)).toEqual(base);
  });

  it("100% devolve exatamente o look", () => {
    expect(mixIntensity(base, look, 1)).toEqual(look);
  });

  it("50% devolve o ponto médio", () => {
    const [r, g, b] = mixIntensity(base, look, 0.5);
    expect(r).toBeCloseTo(0.55);
    expect(g).toBeCloseTo(0.25);
    expect(b).toBeCloseTo(0.55);
  });

  it("limita a intensidade a 0..1", () => {
    expect(clampIntensity(-0.5)).toBe(0);
    expect(clampIntensity(1.7)).toBe(1);
    expect(mixIntensity(base, look, 1.7)).toEqual(look);
  });
});

describe("preparo da LUT para a textura", () => {
  function lutOf(size: number, domainMax = 1): CubeLut {
    // Cada linha do arquivo vira um valor único: a linha n tem RGB (n, n, n).
    const data = new Float32Array(size ** 3 * 3);
    for (let row = 0; row < size ** 3; row++) data.fill(row, row * 3, row * 3 + 3);
    return { size, domainMin: [0, 0, 0], domainMax: [domainMax, domainMax, domainMax], data };
  }

  it("converte a tabela RGB para o formato da textura 3D sem trocar a ordem dos eixos", () => {
    const { size, data } = lutTexture(lutOf(2));
    // Textura 3D: x = vermelho, y = verde, z = azul; vermelho varia mais rápido, como no arquivo.
    const texel = (r: number, g: number, b: number) => {
      const start = ((b * size + g) * size + r) * 3;
      return Array.from(data.slice(start, start + 3));
    };
    expect(texel(0, 0, 0)).toEqual([0, 0, 0]);
    expect(texel(1, 0, 0)).toEqual([1, 1, 1]); // 2ª linha do arquivo
    expect(texel(0, 1, 0)).toEqual([2, 2, 2]);
    expect(texel(0, 0, 1)).toEqual([4, 4, 4]);
  });

  it("calcula escala e deslocamento para amostrar no centro dos texels", () => {
    const { scale, offset } = lutTexture(lutOf(33));
    expect(scale).toBe(32 / 33);
    expect(offset).toBe(0.5 / 33);
  });

  it("normaliza a entrada pelo DOMAIN_MIN/MAX da LUT", () => {
    expect(normalizeInput(1, 0, 2)).toBe(0.5);
    expect(normalizeInput(-1, 0, 2)).toBe(0);
    expect(normalizeInput(3, 0, 2)).toBe(1);
  });
});
