import type { CubeLut } from "./cube-lut";
import { clamp01 } from "./lut-math";

export type LutState = {
  lut: CubeLut | null;
  name: string | null;
  /** O contador faz o aviso ser anunciado de novo quando a mesma mensagem se repete. */
  error: { message: string; attempt: number } | null;
};

export type LutAction =
  | { type: "loaded"; lut: CubeLut; name: string }
  | { type: "failed"; message: string };

export const initialLutState: LutState = { lut: null, name: null, error: null };

export function lutReducer(state: LutState, action: LutAction): LutState {
  if (action.type === "loaded") return { lut: action.lut, name: action.name, error: null };
  // LUT inválida: preserva a anterior (e a prévia) e só mostra o erro.
  return { ...state, error: { message: action.message, attempt: (state.error?.attempt ?? 0) + 1 } };
}

/** Intensidade em % (0..100) → fração para o renderizador; sem LUT a prévia é a base. */
export function effectiveIntensity(state: LutState, percent: number): number {
  return state.lut ? clamp01(percent / 100) : 0;
}
