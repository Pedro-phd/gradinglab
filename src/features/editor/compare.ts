// Lógica pura da comparação antes/depois: sem DOM nem WebGL. A interface e o shader só aplicam o que sai daqui.

export type CompareMode = "compare" | "result" | "original";

export const SPLIT_STEP = 0.02;
export const ORIGINAL_LABEL = "Original · sem conversão";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Posição horizontal do ponteiro → fração 0..1 da largura da prévia; fora dela vale a borda. */
export function splitFromPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 0.5;
  return clamp01((clientX - left) / width);
}

/** Próxima fração para a tecla; null quando a tecla não move o divisor. */
export function nextSplit(current: number, key: string): number | null {
  if (key === "Home") return 0;
  if (key === "End") return 1;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const next = current + (key === "ArrowRight" ? SPLIT_STEP : -SPLIT_STEP);
  return clamp01(Math.round(next * 1e4) / 1e4); // evita 0.52000000001 acumulado
}

export type CompareView = {
  /** O que o shader recebe: à esquerda de split vai a base, à direita o look. */
  uniforms: { split: number; showOriginal: boolean };
  handleVisible: boolean;
  leftLabel: string | null;
  rightLabel: string | null;
};

export function compareView(
  mode: CompareMode,
  split: number,
  look: { lutName: string | null; intensityPercent: number },
): CompareView {
  const after = look.lutName ? `Depois · ${look.lutName} · ${Math.round(look.intensityPercent)}%` : "Depois · nenhuma LUT";
  if (mode === "original") {
    // Até a normalização de Log existir, "original" e "antes" são a mesma imagem; o modo já tem o rótulo certo.
    return { uniforms: { split: 1, showOriginal: true }, handleVisible: false, leftLabel: ORIGINAL_LABEL, rightLabel: null };
  }
  if (mode === "result") {
    return { uniforms: { split: 0, showOriginal: false }, handleVisible: false, leftLabel: null, rightLabel: after };
  }
  return { uniforms: { split: clamp01(split), showOriginal: false }, handleVisible: true, leftLabel: "Antes · sem look", rightLabel: after };
}

/** Fração da barra de tempo → segundos, limitada à duração; null sem duração conhecida. */
export function timeFromFraction(fraction: number, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return clamp01(fraction) * duration;
}
