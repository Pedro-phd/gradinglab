// Presets: receitas do "Ajustar" do app Fotos do iPhone, guardadas nos valores do próprio iPhone
// e convertidas para os sliders do editor. São aproximações: o iPhone não publica as fórmulas.
import { NEUTRAL_EFFECTS, setEffect, type Effects } from "./effects";

/** Os sliders do iPhone, de -100 a 100 (Nitidez, Definição e Vinheta de 0 a 100). */
export type IphoneRecipe = Partial<{
  exposure: number;
  brilliance: number;
  highlights: number;
  shadows: number;
  contrast: number;
  brightness: number;
  blackPoint: number;
  saturation: number;
  vibrance: number;
  warmth: number;
  tint: number;
  sharpness: number;
  definition: number;
  vignette: number;
}>;

export type Preset = { id: string; name: string; description: string; recipe: IphoneRecipe };

/** Converte a receita: Brilho, Realces, Sombras etc. usam a mesma escala; exposição, contraste e saturação mudam de unidade. */
export function fromIphone(recipe: IphoneRecipe): Effects {
  const r = recipe;
  const values: Partial<Effects> = {
    exposure: (r.exposure ?? 0) * 1.5, // centésimos de EV: -100 no iPhone ≈ -1,5 EV
    contrast: (r.contrast ?? 0) / 2, // o contraste do editor vai de -50 a 50
    saturation: 100 + (r.saturation ?? 0),
    temperature: r.warmth ?? 0,
    tint: r.tint ?? 0,
    brilliance: r.brilliance ?? 0,
    highlights: r.highlights ?? 0,
    shadows: r.shadows ?? 0,
    brightness: r.brightness ?? 0,
    blackPoint: r.blackPoint ?? 0,
    vibrance: r.vibrance ?? 0,
    sharpness: r.sharpness ?? 0,
    definition: r.definition ?? 0,
    vignette: r.vignette ?? 0,
  };
  return Object.entries(values).reduce<Effects>((effects, [key, value]) => setEffect(effects, key as keyof Effects, value), NEUTRAL_EFFECTS);
}

// Receitas de @littleyumee (X, novembro de 2026). Nos tweets traduzidos, "Vividez"/"Vibrância" é o Brilho
// e "Saturação natural" é a Vividez; um "Brilho" depois do Contraste é a Luminosidade (ordem do iPhone).
export const PRESETS: Preset[] = [
  { id: "confeitaria", name: "Confeitaria", description: "Acinzentado, com textura", recipe: { vibrance: -30, highlights: -15, shadows: -23, brightness: -21, contrast: 25, saturation: 6, warmth: -10, tint: 16, sharpness: 25, definition: 12 } },
  { id: "fujifilm", name: "Fujifilm", description: "Frio e suave, puxado ao vermelho", recipe: { exposure: -5, brilliance: -8, highlights: 15, shadows: -10, vibrance: -6, warmth: -10, tint: 6, vignette: 10 } },
  { id: "brilho-escuro", name: "Brilho escuro", description: "Escuro com cor viva", recipe: { exposure: 5, brilliance: -29, highlights: -20, shadows: 16, contrast: 18, brightness: 6, vibrance: 30, sharpness: 6, definition: 10 } },
  { id: "nitido-suave", name: "Nítido suave", description: "Mais escuro e bem nítido", recipe: { exposure: -11, brilliance: -9, highlights: -11, brightness: -12, saturation: 11, vibrance: 10, sharpness: 54 } },
  { id: "escuro-nitido", name: "Escuro nítido", description: "Escuro e brilhante", recipe: { exposure: -13, brilliance: -19, highlights: -21, shadows: -13, contrast: 19, warmth: 6, sharpness: 85, definition: 10 } },
  { id: "moody", name: "Moody", description: "Escuro e fechado", recipe: { exposure: -10, brilliance: -15, highlights: 5, shadows: -12, contrast: 8, brightness: -5, sharpness: 15, definition: 10 } },
  { id: "noturno", name: "Noturno", description: "Noite vintage, luzes contidas", recipe: { exposure: -30, brilliance: -25, highlights: -100, shadows: 70, contrast: 20, blackPoint: -10, saturation: 40, vibrance: 30, warmth: 15, tint: 10, vignette: 60 } },
  { id: "nitido-claro", name: "Nítido e claro", description: "Contraste e nitidez", recipe: { exposure: -5, brilliance: -15, highlights: -30, contrast: 15, brightness: -5, vibrance: 15, warmth: -5, tint: 5, sharpness: 35, definition: 10 } },
  // "Filtro Mono +10" (filtro do iPhone a 10%) virou saturação -10.
  { id: "sombrio", name: "Sombrio", description: "Escuro, quase sem cor", recipe: { saturation: -10, exposure: -17, brilliance: -14, shadows: -25, highlights: 15, contrast: 5, brightness: 5, sharpness: 23 } },
];

/** O preset cujos valores são exatamente os ajustes atuais (nenhum, se o usuário mexeu depois). */
export function matchingPreset(effects: Effects): Preset | null {
  return PRESETS.find((preset) => {
    const target = fromIphone(preset.recipe);
    return (Object.keys(target) as (keyof Effects)[]).every((key) => target[key] === effects[key]);
  }) ?? null;
}
