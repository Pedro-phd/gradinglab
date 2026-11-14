import { describe, expect, it } from "vitest";
import { ADJUSTMENTS, effectUniforms, hasEffects, NEUTRAL_EFFECTS, setEffect, whiteBalanceGains } from "./effects";

const luma = ([r, g, b]: number[]) => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;

describe("efeitos", () => {
  it("neutro não liga nada no shader: o caminho sem efeitos continua o de antes", () => {
    const uniforms = effectUniforms(NEUTRAL_EFFECTS);
    expect(hasEffects(NEUTRAL_EFFECTS)).toBe(false);
    expect(uniforms).toMatchObject({ adjust: false, vignette: 0, halation: null, bloom: null, mist: null, grain: 0 });
  });

  it("mexer só num controle secundário (raio, limiar) não conta como efeito ligado", () => {
    expect(hasEffects(setEffect(NEUTRAL_EFFECTS, "halationRadius", 90))).toBe(false);
    expect(effectUniforms(setEffect(NEUTRAL_EFFECTS, "halationRadius", 90)).halation).toBeNull();
    expect(hasEffects(setEffect(NEUTRAL_EFFECTS, "halation", 10))).toBe(true);
  });

  it("setEffect prende o valor na faixa do controle e arredonda", () => {
    expect(setEffect(NEUTRAL_EFFECTS, "exposure", 999).exposure).toBe(200);
    expect(setEffect(NEUTRAL_EFFECTS, "saturation", -5).saturation).toBe(0);
    expect(setEffect(NEUTRAL_EFFECTS, "contrast", 12.6).contrast).toBe(13);
    expect(setEffect(NEUTRAL_EFFECTS, "grain", Number.NaN).grain).toBe(0);
  });

  it("todo controle da interface começa no valor neutro dentro da própria faixa", () => {
    for (const control of ADJUSTMENTS.flatMap((item) => [item.main, ...item.extra])) {
      expect(NEUTRAL_EFFECTS[control.key]).toBeGreaterThanOrEqual(control.min);
      expect(NEUTRAL_EFFECTS[control.key]).toBeLessThanOrEqual(control.max);
    }
  });

  it("balanço de branco: quente puxa para o vermelho, frio para o azul, sem mudar a luminância", () => {
    const [warmR, , warmB] = whiteBalanceGains(60, 0);
    const [coolR, , coolB] = whiteBalanceGains(-60, 0);
    expect(warmR).toBeGreaterThan(warmB);
    expect(coolB).toBeGreaterThan(coolR);
    for (const gains of [whiteBalanceGains(60, 0), whiteBalanceGains(-100, 100), whiteBalanceGains(0, 0)]) {
      expect(luma(gains)).toBeCloseTo(1, 9);
    }
    expect(whiteBalanceGains(0, 0)).toEqual([1, 1, 1]);
  });

  it("converte os valores dos sliders no que o shader recebe", () => {
    const uniforms = effectUniforms({ ...NEUTRAL_EFFECTS, exposure: -150, contrast: 20, saturation: 50, halation: 100, halationThreshold: 80, halationRadius: 50 });
    expect(uniforms).toMatchObject({ adjust: true, exposure: -1.5, contrast: 1.2, saturation: 0.5 });
    expect(uniforms.halation).toEqual({ amount: 1.5, threshold: 0.8, radius: 2 });
  });
});
