import type { CubeLut } from "./cube-lut";
import { clamp01 } from "./lut-math";

/** Limite da pilha: cada LUT ocupa uma unidade de textura (o WebGL2 garante 16; o quadro usa uma). */
export const MAX_STACKED_LUTS = 8;

export type StackedLut = { id: number; lut: CubeLut; name: string; /** 0..100 */ intensity: number };

/** O que o renderizador recebe, na ordem de aplicação. */
export type LutLayer = { lut: CubeLut; /** fração 0..1 */ intensity: number };

export type LutState = {
  /** Ordem de aplicação: a 1ª recebe o quadro, cada seguinte recebe o resultado da anterior. */
  stack: StackedLut[];
  /** A 1ª LUT converte o Log por conta própria; vale só para a LUT que estava em 1º quando foi marcada. */
  firstExpectsLog: boolean;
  nextId: number;
  /** O contador faz o aviso ser anunciado de novo quando a mesma mensagem se repete. */
  error: { message: string; attempt: number } | null;
};

export type LutAction =
  | { type: "added"; lut: CubeLut; name: string }
  | { type: "failed"; message: string }
  | { type: "removed"; id: number }
  | { type: "moved"; id: number; offset: -1 | 1 }
  | { type: "intensity"; id: number; percent: number }
  | { type: "firstExpectsLog"; value: boolean };

export const initialLutState: LutState = { stack: [], firstExpectsLog: false, nextId: 1, error: null };

const fail = (state: LutState, message: string): LutState => ({
  ...state,
  error: { message, attempt: (state.error?.attempt ?? 0) + 1 },
});

// Trocou a 1ª LUT: a marcação "já converte o Log" era dela, então volta a desmarcada.
function withStack(state: LutState, stack: StackedLut[]): LutState {
  const sameFirst = stack[0]?.id === state.stack[0]?.id;
  return { ...state, stack, firstExpectsLog: sameFirst && state.firstExpectsLog, error: null };
}

export function lutReducer(state: LutState, action: LutAction): LutState {
  switch (action.type) {
    case "added":
      if (state.stack.length >= MAX_STACKED_LUTS) return fail(state, `A pilha aceita até ${MAX_STACKED_LUTS} LUTs. Remova uma para adicionar outra.`);
      return { ...withStack(state, [...state.stack, { id: state.nextId, lut: action.lut, name: action.name, intensity: 100 }]), nextId: state.nextId + 1 };
    case "failed":
      // LUT inválida: a pilha (e a prévia) continua como estava; só mostra o erro.
      return fail(state, action.message);
    case "removed":
      return withStack(state, state.stack.filter((item) => item.id !== action.id));
    case "moved": {
      const from = state.stack.findIndex((item) => item.id === action.id);
      const to = from + action.offset;
      if (from < 0 || to < 0 || to >= state.stack.length) return state;
      const stack = [...state.stack];
      [stack[from], stack[to]] = [stack[to]!, stack[from]!];
      return withStack(state, stack);
    }
    case "intensity":
      return { ...state, stack: state.stack.map((item) => (item.id === action.id ? { ...item, intensity: Math.round(clamp01(action.percent / 100) * 100) } : item)) };
    case "firstExpectsLog":
      return { ...state, firstExpectsLog: state.stack.length > 0 && action.value };
  }
}

/** Camadas para o renderizador; sem perfil confirmado nenhuma é aplicada (intensidade 0). */
export function lutLayers(state: LutState, applyLook: boolean): LutLayer[] {
  return state.stack.map(({ lut, intensity }) => ({ lut, intensity: applyLook ? clamp01(intensity / 100) : 0 }));
}

/** Rótulo curto da pilha: nome da LUT quando é uma só, contagem quando são várias. */
export function stackLabel(state: LutState): string | null {
  if (state.stack.length === 0) return null;
  return state.stack.length === 1 ? state.stack[0]!.name : `${state.stack.length} LUTs`;
}
