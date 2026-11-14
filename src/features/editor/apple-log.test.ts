import { describe, expect, it } from "vitest";
import {
  appleLogToLinear,
  apply,
  APPLE_LOG,
  invert,
  linearToAppleLog,
  linearToRec709,
  multiply,
  normalizeAppleLog,
  normalizeAppleLogSoft,
  OETF_BREAK,
  primariesToXyz,
  rec709ToLinear,
  SOFT_KNEE,
  softShoulder,
  REC2020,
  REC2020_TO_REC709,
  type Matrix3,
  type Primaries,
} from "./apple-log";
import type { Rgb } from "./lut-math";

// Referências: OpenColorIO v2.6.0, commit 10a43ec1df03d072ca9a9e2fb3f26e454b0900d8
// (https://github.com/AcademySoftwareFoundation/OpenColorIO). A curva vem de
// src/OpenColorIO/transforms/builtins/AppleCameras.cpp; os pares de entrada/saída, de
// tests/cpu/transforms/BuiltinTransform_tests.cpp. O OCIO compara em float32 com 1e-6.
const OCIO_TOLERANCE = 1e-6;

const expectClose = (actual: readonly number[], expected: readonly number[], tolerance: number) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(Math.abs(value - (expected[i] ?? 0))).toBeLessThan(tolerance));
};

describe("curva Apple Log → linear", () => {
  it("reproduz o par de referência do OCIO (CURVE - APPLE_LOG_to_LINEAR)", () => {
    const out = [0.5, 0.4, 0.3].map(appleLogToLinear);
    expectClose(out, [0.198913991, 0.083076466024, 0.0315782763], OCIO_TOLERANCE);
  });

  it("é contínua no ponto de quebra P_t, que corresponde à luz linear R_t", () => {
    const pt = APPLE_LOG.c * (APPLE_LOG.rt - APPLE_LOG.r0) ** 2;
    expect(appleLogToLinear(pt - 1e-9)).toBeCloseTo(APPLE_LOG.rt, 6);
    expect(appleLogToLinear(pt)).toBeCloseTo(APPLE_LOG.rt, 6);
  });

  it("espelha em R_0 em zero e abaixo dele, como a tabela do OCIO", () => {
    expect(appleLogToLinear(0)).toBeCloseTo(APPLE_LOG.r0, 12);
    expect(appleLogToLinear(-0.3)).toBe(APPLE_LOG.r0);
  });

  it("é monotônica em 0..1", () => {
    const samples = Array.from({ length: 256 }, (_, i) => appleLogToLinear(i / 255));
    samples.slice(1).forEach((value, i) => expect(value).toBeGreaterThanOrEqual(samples[i] ?? 0));
  });
});

describe("matriz Rec.2020 → Rec.709", () => {
  it("preserva o branco D65 (as duas primárias usam o mesmo branco, sem adaptação)", () => {
    expectClose(apply(REC2020_TO_REC709, [1, 1, 1]), [1, 1, 1], 1e-9);
  });

  // A matriz do OCIO não é uma tabela: é calculada das primárias. Para provar que
  // primariesToXyz faz o mesmo cálculo, reproduzo o par APPLE_LOG_to_ACES2065-1 do OCIO
  // (curva + Rec.2020→AP0 com adaptação Bradford D65→D60) e comparo com o valor publicado.
  it("a mesma derivação reproduz o par APPLE_LOG_to_ACES2065-1 do OCIO", () => {
    const D60: [number, number] = [0.32168, 0.33767]; // ColorMatrixHelpers.cpp, ACES_AP0
    const ap0: Primaries = { red: [0.7347, 0.2653], green: [0, 1], blue: [0.0001, -0.077], white: D60 };
    const bradford: Matrix3 = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
    const xyz = ([x, y]: [number, number]): Rgb => [x / y, 1, (1 - x - y) / y];
    const src = apply(bradford, xyz(REC2020.white));
    const dst = apply(bradford, xyz(D60));
    const scale: Matrix3 = [[dst[0] / src[0], 0, 0], [0, dst[1] / src[1], 0], [0, 0, dst[2] / src[2]]];
    const adapt = multiply(invert(bradford), multiply(scale, bradford));
    const rec2020ToAp0 = multiply(invert(primariesToXyz(ap0)), multiply(adapt, primariesToXyz(REC2020)));
    const out = apply(rec2020ToAp0, [0.5, 0.4, 0.3].map(appleLogToLinear) as Rgb);
    expectClose(out, [0.153334766, 0.08351543, 0.032948254], OCIO_TOLERANCE);
  });
});

describe("codificação Rec.709", () => {
  it("mapeia 0 em 0 e 1 em 1 e é contínua entre o trecho linear e o de potência", () => {
    expect(linearToRec709(0)).toBe(0);
    expect(linearToRec709(1)).toBeCloseTo(1, 12);
    // Quebra implícita em gamma 2,2222 e offset 0,099 (GammaOpUtils.cpp): os dois trechos se encontram nela.
    const eps = 1e-11;
    expect(Math.abs(linearToRec709(OETF_BREAK - eps) - linearToRec709(OETF_BREAK + eps))).toBeLessThan(1e-9);
  });
});

describe("conversão Apple Log → Rec.709", () => {
  it("é monotônica em 0..1 em cada canal, e cinza continua cinza", () => {
    const ramp = Array.from({ length: 256 }, (_, i) => normalizeAppleLog([i / 255, i / 255, i / 255]));
    ramp.forEach(([r, g, b]) => {
      expect(g).toBeCloseTo(r, 6);
      expect(b).toBeCloseTo(r, 6);
    });
    ramp.slice(1).forEach((value, i) => expect(value[1]).toBeGreaterThanOrEqual(ramp[i]?.[1] ?? 0));
  });

  it("devolve valores de exibição entre 0 e 1 mesmo com cor fora do gamut", () => {
    for (const rgb of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [0, 0, 0]] as Rgb[]) {
      normalizeAppleLog(rgb).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    }
  });
});

// Os ajustes em luz linear (effects-glsl.ts) vão e voltam por estas curvas: sem ajuste, a imagem não pode mudar.
describe("curvas inversas", () => {
  it("linearToAppleLog desfaz appleLogToLinear nos dois trechos da curva", () => {
    for (const code of [0, 0.05, 0.1, APPLE_LOG.c * (APPLE_LOG.rt - APPLE_LOG.r0) ** 2, 0.3, 0.5, 0.7, 0.9, 1]) {
      // As constantes publicadas não emendam exatamente na quebra (~3e-9): tolerância do OCIO.
      expect(Math.abs(linearToAppleLog(appleLogToLinear(code)) - code)).toBeLessThan(OCIO_TOLERANCE);
    }
  });

  it("rec709ToLinear desfaz linearToRec709, inclusive no trecho reto perto do preto", () => {
    for (const light of [0, OETF_BREAK / 2, OETF_BREAK, 0.18, 0.5, 1]) {
      expect(rec709ToLinear(linearToRec709(light))).toBeCloseTo(light, 9);
    }
  });
});

describe("altas luzes suaves", () => {
  it("abaixo do joelho é a mesma conversão: sombras, pele e cinza médio não mudam", () => {
    for (const code of [0.1, 0.3, 0.45, 0.55]) {
      const rgb: Rgb = [code, code * 0.95, code * 0.9];
      expectClose(normalizeAppleLogSoft(rgb), normalizeAppleLog(rgb), 1e-12);
    }
  });

  it("onde a conversão normal corta em 1, a suave ainda separa os tons", () => {
    const sky = normalizeAppleLogSoft([0.8, 0.8, 0.8])[0];
    const sun = normalizeAppleLogSoft([1, 1, 1])[0];
    expect(normalizeAppleLog([0.8, 0.8, 0.8])[0]).toBe(1);
    expect(sky).toBeLessThan(sun);
    expect(sun).toBeLessThan(1);
  });

  it("o ombro é contínuo, crescente e nunca passa de 1", () => {
    expect(softShoulder(SOFT_KNEE)).toBe(SOFT_KNEE);
    expect(softShoulder(SOFT_KNEE + 1e-9) - SOFT_KNEE).toBeCloseTo(1e-9, 12); // mesma inclinação no joelho
    let previous = 0;
    for (let x = 0; x <= 20; x += 0.25) {
      const y = softShoulder(x);
      expect(y).toBeGreaterThanOrEqual(previous);
      expect(y).toBeLessThanOrEqual(1);
      previous = y;
    }
  });
});
