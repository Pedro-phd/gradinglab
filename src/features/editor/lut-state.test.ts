import { describe, expect, it } from "vitest";
import type { CubeLut } from "./cube-lut";
import { canAdjustIntensity, effectiveIntensity, initialLutState, lutReducer } from "./lut-state";

const lut: CubeLut = {
  size: 2,
  domainMin: [0, 0, 0],
  domainMax: [1, 1, 1],
  data: new Float32Array(24),
};

describe("estado da LUT no editor", () => {
  it("LUT inválida mantém a LUT anterior e expõe a mensagem de erro", () => {
    const loaded = lutReducer(initialLutState, { type: "loaded", lut, name: "look.cube" });
    const failed = lutReducer(loaded, { type: "failed", message: "Arquivo inválido." });
    expect(failed.lut).toBe(lut);
    expect(failed.name).toBe("look.cube");
    expect(failed.error?.message).toBe("Arquivo inválido.");
  });

  it("uma LUT válida limpa o erro anterior", () => {
    const failed = lutReducer(initialLutState, { type: "failed", message: "Arquivo inválido." });
    const loaded = lutReducer(failed, { type: "loaded", lut, name: "look.cube" });
    expect(loaded.error).toBeNull();
  });

  it("repetir o mesmo erro muda o estado, para o aviso ser anunciado de novo", () => {
    const first = lutReducer(initialLutState, { type: "failed", message: "x" });
    const second = lutReducer(first, { type: "failed", message: "x" });
    expect(second.error?.attempt).not.toBe(first.error?.attempt);
  });

  it("sem LUT carregada, a prévia mostra a base e o controle de intensidade fica desabilitado", () => {
    expect(canAdjustIntensity(initialLutState)).toBe(false);
    expect(effectiveIntensity(initialLutState, 80)).toBe(0);
  });

  it("com LUT, a intensidade em % vira fração limitada a 0..1", () => {
    const loaded = lutReducer(initialLutState, { type: "loaded", lut, name: "look.cube" });
    expect(canAdjustIntensity(loaded)).toBe(true);
    expect(effectiveIntensity(loaded, 80)).toBe(0.8);
    expect(effectiveIntensity(loaded, 250)).toBe(1);
  });
});
