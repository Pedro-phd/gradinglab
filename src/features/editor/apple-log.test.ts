import { describe, expect, it } from "vitest";
import {
  appleLogToLinear,
  apply,
  APPLE_LOG,
  invert,
  linearToRec709,
  multiply,
  normalizeAppleLog,
  primariesToXyz,
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
    const knee = 0.018053968510807; // quebra implícita em gamma 2,2222 e offset 0,099 (GammaOpUtils.cpp)
    expect(Math.abs(linearToRec709(knee - 1e-9) - linearToRec709(knee + 1e-9))).toBeLessThan(1e-8);
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
