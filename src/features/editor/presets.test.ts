import { describe, expect, it } from "vitest";
import { ADJUSTMENTS, NEUTRAL_EFFECTS, setEffect } from "./effects";
import { fromIphone, matchingPreset, PRESETS } from "./presets";

describe("presets", () => {
  it("receita vazia é o neutro", () => {
    expect(fromIphone({})).toEqual(NEUTRAL_EFFECTS);
  });

  it("converte as unidades do iPhone para as do editor", () => {
    const effects = fromIphone({ exposure: -14, contrast: 19, saturation: -10, warmth: 6, highlights: -21, sharpness: 85 });
    expect(effects).toMatchObject({ exposure: -21, contrast: 10, saturation: 90, temperature: 6, highlights: -21, sharpness: 85 });
  });

  it("todo preset cabe nas faixas dos controles e tem id único", () => {
    const controls = ADJUSTMENTS.flatMap((item) => [item.main, ...item.extra]);
    for (const preset of PRESETS) {
      const effects = fromIphone(preset.recipe);
      for (const control of controls) {
        expect(effects[control.key]).toBeGreaterThanOrEqual(control.min);
        expect(effects[control.key]).toBeLessThanOrEqual(control.max);
      }
    }
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
  });

  it("reconhece o preset aplicado e deixa de reconhecer depois de um ajuste à mão", () => {
    const noturno = PRESETS.find((preset) => preset.id === "noturno")!;
    const applied = fromIphone(noturno.recipe);
    expect(matchingPreset(applied)?.id).toBe("noturno");
    expect(matchingPreset(setEffect(applied, "sharpness", 40))).toBeNull();
    expect(matchingPreset(NEUTRAL_EFFECTS)).toBeNull();
  });
});
