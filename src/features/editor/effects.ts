// Ajustes e efeitos de filme aplicados junto com a pilha de LUTs, sem DOM nem WebGL.
// A interface guarda inteiros de slider; effectUniforms converte para o que o shader recebe.
import type { Rgb } from "./lut-math";

export type Effects = {
  exposure: number; // centésimos de EV, -200..200
  temperature: number; // -100 (frio) .. 100 (quente)
  tint: number; // -100 (verde) .. 100 (magenta)
  contrast: number; // -50..50
  saturation: number; // %, 0..200
  // Mesmos nomes e faixas do "Ajustar" do app Fotos do iPhone, para as receitas valerem direto.
  brilliance: number; // -100..100: sobe as sombras e segura as luzes (ou o contrário)
  highlights: number; // -100..100
  shadows: number; // -100..100
  brightness: number; // -100..100: meios-tons
  blackPoint: number; // -100..100: positivo afunda os pretos
  vibrance: number; // -100..100: satura mais o que tem pouca cor
  sharpness: number; // 0..100
  definition: number; // 0..100: contraste local
  halation: number; // 0..100; 0 desliga
  halationThreshold: number; // % da luz a partir da qual brilha
  halationRadius: number;
  bloom: number;
  bloomThreshold: number;
  bloomRadius: number;
  mist: number; // difusão tipo Pro-Mist
  mistThreshold: number;
  mistRadius: number;
  grain: number;
  grainSize: number; // décimos de pixel a 1080p, 10..40
  vignette: number;
  vignetteSoftness: number;
};

export type EffectKey = keyof Effects;

export const NEUTRAL_EFFECTS: Effects = {
  exposure: 0,
  temperature: 0,
  tint: 0,
  contrast: 0,
  saturation: 100,
  brilliance: 0,
  highlights: 0,
  shadows: 0,
  brightness: 0,
  blackPoint: 0,
  vibrance: 0,
  sharpness: 0,
  definition: 0,
  halation: 0,
  halationThreshold: 75,
  halationRadius: 35,
  bloom: 0,
  bloomThreshold: 65,
  bloomRadius: 60,
  mist: 0,
  mistThreshold: 35,
  mistRadius: 45,
  grain: 0,
  grainSize: 15,
  vignette: 0,
  vignetteSoftness: 60,
};

export type EffectControl = { key: EffectKey; label: string; min: number; max: number; format: (value: number) => string };
/** Um item da fileira de ajustes: o controle principal e, nos efeitos de filme, os secundários. */
export type Adjustment = { id: string; label: string; main: EffectControl; extra: EffectControl[] };

const decimal = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const plain = (value: number) => String(value);
const percent = (value: number) => `${value}%`;
const control = (key: EffectKey, label: string, min: number, max: number, format = plain): EffectControl => ({ key, label, min, max, format });

export const ADJUSTMENTS: Adjustment[] = [
  { id: "exposure", label: "Exposição", main: control("exposure", "Exposição (EV)", -200, 200, (value) => `${value > 0 ? "+" : ""}${decimal(value / 100, 2)}`), extra: [] },
  { id: "brilliance", label: "Brilho", main: control("brilliance", "Brilho", -100, 100, signed), extra: [] },
  { id: "highlights", label: "Realces", main: control("highlights", "Realces", -100, 100, signed), extra: [] },
  { id: "shadows", label: "Sombras", main: control("shadows", "Sombras", -100, 100, signed), extra: [] },
  { id: "contrast", label: "Contraste", main: control("contrast", "Contraste", -50, 50, signed), extra: [] },
  { id: "brightness", label: "Luminosidade", main: control("brightness", "Luminosidade", -100, 100, signed), extra: [] },
  { id: "blackPoint", label: "Ponto preto", main: control("blackPoint", "Ponto preto", -100, 100, signed), extra: [] },
  { id: "saturation", label: "Saturação", main: control("saturation", "Saturação", 0, 200, percent), extra: [] },
  { id: "vibrance", label: "Vividez", main: control("vibrance", "Vividez", -100, 100, signed), extra: [] },
  { id: "temperature", label: "Temperatura", main: control("temperature", "Temperatura", -100, 100, signed), extra: [] },
  { id: "tint", label: "Tom", main: control("tint", "Tom", -100, 100, signed), extra: [] },
  { id: "sharpness", label: "Nitidez", main: control("sharpness", "Nitidez", 0, 100, plain), extra: [] },
  { id: "definition", label: "Definição", main: control("definition", "Definição", 0, 100, plain), extra: [] },
  { id: "halation", label: "Halation", main: control("halation", "Halation", 0, 100), extra: [control("halationThreshold", "A partir de", 30, 100, percent), control("halationRadius", "Raio", 5, 100)] },
  { id: "bloom", label: "Bloom", main: control("bloom", "Bloom", 0, 100), extra: [control("bloomThreshold", "A partir de", 20, 100, percent), control("bloomRadius", "Raio", 5, 100)] },
  { id: "mist", label: "Difusão", main: control("mist", "Difusão", 0, 100), extra: [control("mistThreshold", "A partir de", 0, 90, percent), control("mistRadius", "Raio", 5, 100)] },
  { id: "grain", label: "Granulação", main: control("grain", "Granulação", 0, 100), extra: [control("grainSize", "Tamanho", 10, 40, (value) => decimal(value / 10, 1))] },
  { id: "vignette", label: "Vinheta", main: control("vignette", "Vinheta", 0, 100), extra: [control("vignetteSoftness", "Suavidade", 10, 100)] },
];

const RANGES = new Map(ADJUSTMENTS.flatMap((item) => [item.main, ...item.extra]).map((entry) => [entry.key, entry]));

/** Valor do slider, arredondado e dentro da faixa do controle. */
export function setEffect(effects: Effects, key: EffectKey, value: number): Effects {
  const range = RANGES.get(key)!;
  const next = Number.isFinite(value) ? Math.round(Math.min(range.max, Math.max(range.min, value))) : NEUTRAL_EFFECTS[key];
  return { ...effects, [key]: next };
}

/** O controle principal saiu do neutro: é o que conta como "ajuste aplicado". */
export function isAdjusted(effects: Effects, item: Adjustment): boolean {
  return effects[item.main.key] !== NEUTRAL_EFFECTS[item.main.key];
}

export function hasEffects(effects: Effects): boolean {
  return ADJUSTMENTS.some((item) => isAdjusted(effects, item));
}

const LUMA_709: Rgb = [0.2126, 0.7152, 0.0722];

/** Ganhos de balanço de branco em luz linear, com a luminância mantida em 1. */
export function whiteBalanceGains(temperature: number, tint: number): Rgb {
  const warm = temperature / 100;
  const magenta = tint / 100;
  const gains: Rgb = [1 + 0.25 * warm, 1 - 0.18 * magenta, 1 - 0.25 * warm];
  const luma = gains[0] * LUMA_709[0] + gains[1] * LUMA_709[1] + gains[2] * LUMA_709[2];
  return gains.map((gain) => gain / luma) as Rgb;
}

export type Glow = { amount: number; threshold: number; radius: number };

// Ajustes de cor feitos pixel a pixel em adjustLinear; nitidez, definição e os efeitos de filme vão por fora.
const COLOR_KEYS: EffectKey[] = ["exposure", "temperature", "tint", "contrast", "saturation", "brilliance", "highlights", "shadows", "brightness", "blackPoint", "vibrance"];
const clampUnit = (value: number) => Math.min(1, Math.max(-1, value));

/** Ponto preto, sombras, realces e luminosidade em -1..1. O Brilho não tem curva própria: sobe as sombras, segura as luzes e clareia um pouco. */
export function toneUniform(effects: Effects): [number, number, number, number] {
  const brilliance = effects.brilliance / 100;
  return [effects.blackPoint / 100, clampUnit(effects.shadows / 100 + 0.5 * brilliance), clampUnit(effects.highlights / 100 - 0.5 * brilliance), clampUnit(effects.brightness / 100 + 0.2 * brilliance)];
}

/** O que o shader recebe. Raio do brilho em texels de 1/4 da resolução de um quadro com 1080 no lado menor. */
export function effectUniforms(effects: Effects) {
  const adjust = COLOR_KEYS.some((key) => effects[key] !== NEUTRAL_EFFECTS[key]);
  const glow = (amount: number, threshold: number, radius: number, gain: number): Glow | null =>
    amount > 0 ? { amount: (amount / 100) * gain, threshold: threshold / 100, radius: radius / 25 } : null;
  return {
    adjust,
    exposure: effects.exposure / 100,
    whiteBalance: whiteBalanceGains(effects.temperature, effects.tint),
    contrast: 1 + effects.contrast / 100,
    saturation: effects.saturation / 100,
    tone: toneUniform(effects),
    vibrance: effects.vibrance / 100,
    sharpness: effects.sharpness / 100,
    // Definição: luminância borrada (limiar 0) para comparar cada pixel com a vizinhança.
    definition: glow(effects.definition, 0, 30, 1),
    vignette: (effects.vignette / 100) * 0.85,
    vignetteSoftness: effects.vignetteSoftness / 100,
    halation: glow(effects.halation, effects.halationThreshold, effects.halationRadius, 1.5),
    bloom: glow(effects.bloom, effects.bloomThreshold, effects.bloomRadius, 1.2),
    mist: glow(effects.mist, effects.mistThreshold, effects.mistRadius, 1),
    grain: effects.grain / 100,
    grainSize: effects.grainSize / 10,
  };
}

export type EffectUniforms = ReturnType<typeof effectUniforms>;
