import { describe, expect, it } from "vitest";
import { compareView, nextSplit, splitFromPointer, timeFromFraction } from "./compare";

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
    expect(nextSplit(0.5, "Home")).toBe(0);
    expect(nextSplit(0.5, "End")).toBe(1);
  });

  it("o passo do teclado para nas bordas e ignora outras teclas", () => {
    expect(nextSplit(0.99, "ArrowRight")).toBe(1);
    expect(nextSplit(0.01, "ArrowLeft")).toBe(0);
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
  it("converte a posição na barra de tempo em segundos, limitada à duração", () => {
    expect(timeFromFraction(1 / 3, 42)).toBeCloseTo(14);
    expect(timeFromFraction(2, 42)).toBe(42);
    expect(timeFromFraction(-1, 42)).toBe(0);
  });

  it("não navega quando a duração é desconhecida", () => {
    expect(timeFromFraction(0.5, Number.NaN)).toBeNull();
    expect(timeFromFraction(0.5, Number.POSITIVE_INFINITY)).toBeNull();
    expect(timeFromFraction(0.5, 0)).toBeNull();
  });
});
