// Normalização Apple Log → Rec.709, sem WebGL. O shader (lut-renderer.ts) recebe o mesmo
// cálculo em GLSL gerado das constantes deste arquivo; os testes fixam o contrato aqui.
//
// Fonte das constantes: OpenColorIO v2.6.0, commit 10a43ec1df03d072ca9a9e2fb3f26e454b0900d8
// (https://github.com/AcademySoftwareFoundation/OpenColorIO), cujas transformadas Apple Log
// são as referenciadas pelo ACES (CSC.Apple.AppleLog_BT2020_to_ACES, no studio-config).
//  - curva: src/OpenColorIO/transforms/builtins/AppleCameras.cpp (APPLE_LOG);
//  - primárias Rec.709 e Rec.2020 (D65): src/OpenColorIO/transforms/builtins/ColorMatrixHelpers.cpp;
//  - codificação Rec.709 de câmera (gamma 2,2222, offset 0,099): studio-config-v4.0.0_aces-v2.0_ocio-v2.5.ocio,
//    com quebra e inclinação do trecho linear derivadas como em src/OpenColorIO/ops/gamma/GammaOpUtils.cpp.
// Não há tone mapping: é conversão colorimétrica, e a luz acima de 1 em Rec.709 é cortada.
import type { Rgb } from "./lut-math";

export type Matrix3 = [Rgb, Rgb, Rgb]; // por linhas
type Chromaticity = [number, number]; // xy
export type Primaries = { red: Chromaticity; green: Chromaticity; blue: Chromaticity; white: Chromaticity };

const D65: Chromaticity = [0.3127, 0.329];
export const REC709: Primaries = { red: [0.64, 0.33], green: [0.3, 0.6], blue: [0.15, 0.06], white: D65 };
export const REC2020: Primaries = { red: [0.708, 0.292], green: [0.17, 0.797], blue: [0.131, 0.046], white: D65 };

export const APPLE_LOG = {
  r0: -0.05641088,
  rt: 0.01,
  c: 47.28711236,
  beta: 0.00964052,
  gamma: 0.08550479,
  delta: 0.69336945,
};
const PT = APPLE_LOG.c * (APPLE_LOG.rt - APPLE_LOG.r0) ** 2;

const OETF_GAMMA = 2.22222222222222;
const OETF_OFFSET = 0.099;
export const OETF_BREAK = ((OETF_OFFSET * OETF_GAMMA) / ((OETF_GAMMA - 1) * (1 + OETF_OFFSET))) ** OETF_GAMMA;
const OETF_SLOPE = ((OETF_GAMMA - 1) / OETF_OFFSET) ** (OETF_GAMMA - 1) * ((1 + OETF_OFFSET) / OETF_GAMMA) ** OETF_GAMMA;

export function apply(m: Matrix3, v: Rgb): Rgb {
  return [0, 1, 2].map((i) => m[i]![0] * v[0] + m[i]![1] * v[1] + m[i]![2] * v[2]) as Rgb;
}

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i]![0] * b[0]![j]! + a[i]![1] * b[1]![j]! + a[i]![2] * b[2]![j]!)) as Matrix3;
}

export function invert(m: Matrix3): Matrix3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const cofactors: Matrix3 = [
    [e * i - f * h, c * h - b * i, b * f - c * e],
    [f * g - d * i, a * i - c * g, c * d - a * f],
    [d * h - e * g, b * g - a * h, a * e - b * d],
  ];
  const det = a * cofactors[0][0] + b * cofactors[1][0] + c * cofactors[2][0];
  return cofactors.map((row) => row.map((value) => value / det)) as Matrix3;
}

/** RGB linear → XYZ: colunas = primárias em XYZ, escaladas para que RGB (1,1,1) dê o branco. */
export function primariesToXyz({ red, green, blue, white }: Primaries): Matrix3 {
  const xyz = ([x, y]: Chromaticity): Rgb => [x / y, 1, (1 - x - y) / y];
  const columns = [red, green, blue].map(xyz);
  const unscaled: Matrix3 = [0, 1, 2].map((row) => columns.map((column) => column[row]!)) as Matrix3;
  const scale = apply(invert(unscaled), xyz(white));
  return unscaled.map((row) => row.map((value, column) => value * scale[column]!)) as Matrix3;
}

// Mesmo branco D65 nos dois lados: sem adaptação cromática.
export const REC2020_TO_REC709: Matrix3 = multiply(invert(primariesToXyz(REC709)), primariesToXyz(REC2020));

/** Código Apple Log (0..1) → luz linear de cena. */
export function appleLogToLinear(p: number): number {
  const { r0, c, beta, gamma, delta } = APPLE_LOG;
  if (p >= PT) return 2 ** ((p - delta) / gamma) - beta;
  if (p >= 0) return Math.sqrt(p / c) + r0;
  return r0;
}

/** Luz linear (0..1) → código Rec.709. */
export function linearToRec709(x: number): number {
  return x < OETF_BREAK ? OETF_SLOPE * x : (1 + OETF_OFFSET) * x ** (1 / OETF_GAMMA) - OETF_OFFSET;
}

/** Quadro Apple Log (RGB 0..1, Rec.2020) → imagem Rec.709 codificada, em 0..1. */
export function normalizeAppleLog(rgb: Rgb): Rgb {
  const linear = apply(REC2020_TO_REC709, rgb.map(appleLogToLinear) as Rgb);
  return linear.map((value) => linearToRec709(Math.min(1, Math.max(0, value)))) as Rgb;
}

const glsl = (value: number) => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const matrixColumns = REC2020_TO_REC709[0].flatMap((_, column) => REC2020_TO_REC709.map((row) => row[column]!)); // mat3 do GLSL é por colunas

/** Mesmo cálculo de normalizeAppleLog, para o fragment shader. */
export const NORMALIZE_APPLE_LOG_GLSL = `
float appleLogToLinear(float p) {
  if (p >= ${glsl(PT)}) return exp2((p - ${glsl(APPLE_LOG.delta)}) / ${glsl(APPLE_LOG.gamma)}) - ${glsl(APPLE_LOG.beta)};
  if (p >= 0.0) return sqrt(p / ${glsl(APPLE_LOG.c)}) + ${glsl(APPLE_LOG.r0)};
  return ${glsl(APPLE_LOG.r0)};
}

float linearToRec709(float x) {
  return x < ${glsl(OETF_BREAK)} ? ${glsl(OETF_SLOPE)} * x : ${glsl(1 + OETF_OFFSET)} * pow(x, ${glsl(1 / OETF_GAMMA)}) - ${glsl(OETF_OFFSET)};
}

vec3 normalizeAppleLog(vec3 p) {
  vec3 linear = vec3(appleLogToLinear(p.r), appleLogToLinear(p.g), appleLogToLinear(p.b));
  vec3 rec709 = clamp(mat3(${matrixColumns.map(glsl).join(", ")}) * linear, 0.0, 1.0);
  return vec3(linearToRec709(rec709.r), linearToRec709(rec709.g), linearToRec709(rec709.b));
}`;
