import { describe, expect, it } from "vitest";
import type { CubeLut } from "./cube-lut";
import { initialLutState, lutLayers, lutReducer, MAX_STACKED_LUTS, stackLabel, type LutAction, type LutState } from "./lut-state";

const lut = (): CubeLut => ({ size: 2, domainMin: [0, 0, 0], domainMax: [1, 1, 1], data: new Float32Array(24) });
const run = (...actions: LutAction[]): LutState => actions.reduce(lutReducer, initialLutState);
const add = (name: string): LutAction => ({ type: "added", lut: lut(), name });
const names = (state: LutState) => state.stack.map((item) => item.name);

describe("pilha de LUTs do editor", () => {
  it("empilha na ordem de importação, cada uma com 100% de intensidade", () => {
    const state = run(add("conversao.cube"), add("look.cube"));
    expect(names(state)).toEqual(["conversao.cube", "look.cube"]);
    expect(state.stack.map((item) => item.intensity)).toEqual([100, 100]);
  });

  it("LUT inválida mantém a pilha e expõe a mensagem de erro", () => {
    const state = run(add("look.cube"), { type: "failed", message: "Arquivo inválido." });
    expect(names(state)).toEqual(["look.cube"]);
    expect(state.error?.message).toBe("Arquivo inválido.");
  });

  it("repetir o mesmo erro muda o estado, para o aviso ser anunciado de novo", () => {
    const first = run({ type: "failed", message: "x" });
    const second = lutReducer(first, { type: "failed", message: "x" });
    expect(second.error?.attempt).not.toBe(first.error?.attempt);
  });

  it("recusa passar do limite sem perder as LUTs já empilhadas", () => {
    const full = run(...Array.from({ length: MAX_STACKED_LUTS }, (_, i) => add(`${i}.cube`)));
    const state = lutReducer(full, add("extra.cube"));
    expect(state.stack).toHaveLength(MAX_STACKED_LUTS);
    expect(state.error).not.toBeNull();
  });

  it("move, remove e ajusta a intensidade só da LUT indicada", () => {
    let state = run(add("a.cube"), add("b.cube"), add("c.cube"));
    const [a, b] = state.stack;
    state = lutReducer(state, { type: "moved", id: b!.id, offset: -1 });
    expect(names(state)).toEqual(["b.cube", "a.cube", "c.cube"]);
    expect(lutReducer(state, { type: "moved", id: b!.id, offset: -1 })).toBe(state); // já é a 1ª
    state = lutReducer(state, { type: "intensity", id: a!.id, percent: 250 });
    expect(state.stack.map((item) => item.intensity)).toEqual([100, 100, 100]);
    state = lutReducer(state, { type: "intensity", id: a!.id, percent: 40 });
    expect(state.stack.map((item) => item.intensity)).toEqual([100, 40, 100]);
    state = lutReducer(state, { type: "removed", id: a!.id });
    expect(names(state)).toEqual(["b.cube", "c.cube"]);
  });

  it("a marcação de conversão de Log vale só enquanto a mesma LUT está em 1º", () => {
    const marked = run(add("conversao.cube"), add("look.cube"), { type: "firstExpectsLog", value: true });
    expect(marked.firstExpectsLog).toBe(true);
    expect(lutReducer(marked, add("outro.cube")).firstExpectsLog).toBe(true);
    expect(lutReducer(marked, { type: "moved", id: marked.stack[1]!.id, offset: -1 }).firstExpectsLog).toBe(false);
    expect(lutReducer(marked, { type: "removed", id: marked.stack[0]!.id }).firstExpectsLog).toBe(false);
    expect(run({ type: "firstExpectsLog", value: true }).firstExpectsLog).toBe(false); // sem LUT não há o que marcar
  });

  it("camadas levam a intensidade em fração; sem perfil confirmado nenhuma é aplicada", () => {
    const state = run(add("a.cube"), add("b.cube"));
    const withSecondAt = lutReducer(state, { type: "intensity", id: state.stack[1]!.id, percent: 80 });
    expect(lutLayers(withSecondAt, true).map((layer) => layer.intensity)).toEqual([1, 0.8]);
    expect(lutLayers(withSecondAt, false).map((layer) => layer.intensity)).toEqual([0, 0]);
  });

  it("o rótulo mostra o nome com uma LUT e a contagem com várias", () => {
    expect(stackLabel(initialLutState)).toBeNull();
    expect(stackLabel(run(add("look.cube")))).toBe("look.cube");
    expect(stackLabel(run(add("a.cube"), add("b.cube")))).toBe("2 LUTs");
  });
});
