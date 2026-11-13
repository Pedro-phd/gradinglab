// Lógica pura da comparação antes/depois: sem DOM nem WebGL. A interface e o shader só aplicam o que sai daqui.

import { clamp01 } from "./lut-math";

export type CompareMode = "compare" | "result" | "original";

export const SPLIT_STEP = 0.02;
export const SPLIT_PAGE_STEP = 0.1;
export const SEEK_STEP = 1; // segundos por seta na barra de tempo
export const ORIGINAL_LABEL = "Original · sem conversão";

/** Posição horizontal do ponteiro → fração 0..1 da largura da prévia; fora dela vale a borda. */
export function splitFromPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 0.5;
  return clamp01((clientX - left) / width);
}

/** Próxima fração para a tecla; null quando a tecla não move o divisor. */
export function nextSplit(current: number, key: string): number | null {
  if (key === "Home") return 0;
  if (key === "End") return 1;
  const step = { ArrowRight: SPLIT_STEP, ArrowUp: SPLIT_STEP, ArrowLeft: -SPLIT_STEP, ArrowDown: -SPLIT_STEP, PageUp: SPLIT_PAGE_STEP, PageDown: -SPLIT_PAGE_STEP }[key];
  if (step === undefined) return null;
  return clamp01(Math.round((current + step) * 1e4) / 1e4); // evita 0.52000000001 acumulado
}

export type CompareView = {
  /** O que o shader recebe: à esquerda de split vai a base, à direita o look. */
  uniforms: { split: number; showOriginal: boolean };
  handleVisible: boolean;
  leftLabel: string | null;
  rightLabel: string | null;
  /** Versões curtas, para telas estreitas. */
  leftShort: string | null;
  rightShort: string | null;
};

export function compareView(
  mode: CompareMode,
  split: number,
  look: { lutName: string | null; intensityPercent: number; normalizedBase?: boolean },
): CompareView {
  const percent = Math.round(look.intensityPercent);
  const after = look.lutName ? `Depois · ${look.lutName} · ${percent}%` : "Depois · nenhuma LUT";
  const afterShort = look.lutName ? `Depois · ${percent}%` : "Depois";
  if (mode === "original") {
    // "Original" é o quadro como veio, sem a conversão de Log que já está em "antes".
    return { uniforms: { split: 1, showOriginal: true }, handleVisible: false, leftLabel: ORIGINAL_LABEL, rightLabel: null, leftShort: "Original", rightShort: null };
  }
  if (mode === "result") {
    return { uniforms: { split: 0, showOriginal: false }, handleVisible: false, leftLabel: null, rightLabel: after, leftShort: null, rightShort: afterShort };
  }
  return { uniforms: { split: clamp01(split), showOriginal: false }, handleVisible: true, leftLabel: look.normalizedBase ? "Antes · Rec.709, sem look" : "Antes · sem look", rightLabel: after, leftShort: "Antes", rightShort: afterShort };
}

/** Segundos da barra de tempo após a tecla (seta = 1 s); null quando a tecla não navega ou a duração é desconhecida. */
export function nextTime(current: number, key: string, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const step = { ArrowRight: SEEK_STEP, ArrowUp: SEEK_STEP, ArrowLeft: -SEEK_STEP, ArrowDown: -SEEK_STEP }[key];
  if (step === undefined) return null;
  return Math.min(duration, Math.max(0, current + step));
}
