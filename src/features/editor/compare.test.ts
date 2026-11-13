import { describe, expect, it } from "vitest";
import { compareView, nextSplit, splitFromPointer, nextTime } from "./compare";

const lutLabel = { lutName: "Entardecer_Quente.cube", intensityPercent: 80 };

describe("posição do divisor", () => {
  it("converte a posição do ponteiro em fração 0..1 da largura da prévia", () => {
    expect(splitFromPointer(500, 100, 800)).toBe(0.5);
  });

  it("limita a fração a 0..1 quando o ponteiro sai da prévia", () => {
    expect(splitFromPointer(50, 100, 800)).toBe(0);
    expect(splitFromPointer(1200, 100, 800)).toBe(1);
  });

  it("não quebra com prévia sem largura", () => {
    expect(splitFromPointer(500, 100, 0)).toBe(0.5);
  });

  it("teclado move o divisor em passos fixos", () => {
    expect(nextSplit(0.5, "ArrowRight")).toBe(0.52);
    expect(nextSplit(0.5, "ArrowLeft")).toBe(0.48);
    expect(nextSplit(0.5, "ArrowUp")).toBe(0.52);
    expect(nextSplit(0.5, "ArrowDown")).toBe(0.48);
    expect(nextSplit(0.5, "PageUp")).toBe(0.6);
    expect(nextSplit(0.5, "PageDown")).toBe(0.4);
    expect(nextSplit(0.5, "Home")).toBe(0);
    expect(nextSplit(0.5, "End")).toBe(1);
  });

  it("o passo do teclado para nas bordas e ignora outras teclas", () => {
    expect(nextSplit(0.99, "ArrowRight")).toBe(1);
    expect(nextSplit(0.01, "ArrowLeft")).toBe(0);
    expect(nextSplit(0.95, "PageUp")).toBe(1);
    expect(nextSplit(0.05, "PageDown")).toBe(0);
    expect(nextSplit(0.5, "a")).toBeNull();
  });
});

describe("modo de comparação", () => {
  it("'antes/depois' entrega ao shader a fração do divisor", () => {
    const view = compareView("compare", 0.5, lutLabel);
    expect(view.uniforms).toEqual({ split: 0.5, showOriginal: false });
    expect(view.handleVisible).toBe(true);
  });

  it("'só o resultado' equivale a divisor em 0 e esconde a alça", () => {
    const view = compareView("result", 0.5, lutLabel);
    expect(view.uniforms.split).toBe(0);
    expect(view.uniforms.showOriginal).toBe(false);
    expect(view.handleVisible).toBe(false);
  });

  it("'original' mostra o quadro sem normalização nem look, com rótulo próprio", () => {
    const view = compareView("original", 0.5, lutLabel);
    expect(view.uniforms.showOriginal).toBe(true);
    expect(view.handleVisible).toBe(false);
    expect(view.leftLabel).toBe("Original · sem conversão");
    expect(view.rightLabel).toBeNull();
  });

  it("rótulos identificam cada lado", () => {
    const view = compareView("compare", 0.5, lutLabel);
    expect(view.leftLabel).toBe("Antes · sem look");
    expect(view.rightLabel).toContain("Entardecer_Quente.cube");
    expect(view.rightLabel).toContain("80%");
  });

  it("versões curtas dos rótulos cabem em tela estreita", () => {
    const view = compareView("compare", 0.5, lutLabel);
    expect(view.leftShort).toBe("Antes");
    expect(view.rightShort).toBe("Depois · 80%");
  });

  it("'só o resultado' mostra só o rótulo do depois", () => {
    const view = compareView("result", 0.5, lutLabel);
    expect(view.leftLabel).toBeNull();
    expect(view.rightLabel).toContain("80%");
  });

  it("sem LUT o rótulo do depois não inventa nome nem intensidade", () => {
    const view = compareView("compare", 0.5, { lutName: null, intensityPercent: 100 });
    expect(view.rightLabel).toBe("Depois · nenhuma LUT");
  });
});

describe("tempo", () => {
  it("setas andam 1 s na barra de tempo, limitadas à duração", () => {
    expect(nextTime(10, "ArrowRight", 42)).toBe(11);
    expect(nextTime(10, "ArrowDown", 42)).toBe(9);
    expect(nextTime(41.5, "ArrowUp", 42)).toBe(42);
    expect(nextTime(0.4, "ArrowLeft", 42)).toBe(0);
  });

  it("não navega com outra tecla nem com duração desconhecida", () => {
    expect(nextTime(10, "a", 42)).toBeNull();
    expect(nextTime(10, "ArrowRight", Number.NaN)).toBeNull();
    expect(nextTime(10, "ArrowRight", Number.POSITIVE_INFINITY)).toBeNull();
    expect(nextTime(10, "ArrowRight", 0)).toBeNull();
  });
});
