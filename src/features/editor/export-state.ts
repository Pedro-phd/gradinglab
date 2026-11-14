// Máquina de estados da exportação, pura: o hook só traduz os eventos do processamento em ações.
import { exportError, type ExportError, type ExportSummary } from "./export-plan";

export type ExportOutput = { blob: Blob };

export type ExportState = {
  status: "idle" | "preparing" | "encoding" | "finalizing" | "done" | "cancelled" | "failed";
  plan: ExportSummary | null;
  framesDone: number;
  /** Etapa da preparação, para a tela dizer onde está (e onde parou, se parar). */
  stage: string | null;
  /** Instantes (ms, relógio do hook) do início da codificação e do último progresso: base da estimativa de tempo. */
  startedAt: number | null;
  lastAt: number | null;
  /** Só existe em "done": cancelar ou falhar nunca deixa arquivo. */
  output: ExportOutput | null;
  error: ExportError | null;
};

export type ExportAction =
  | { type: "start" }
  | { type: "stage"; stage: string }
  | { type: "prepared"; plan: ExportSummary; at?: number }
  | { type: "progress"; done: number; at?: number }
  | { type: "finalizing" }
  | { type: "finished"; framesWritten: number; output: ExportOutput }
  | { type: "cancel" }
  | { type: "fail"; error: ExportError }
  | { type: "reset" };

export const idleExport: ExportState = { status: "idle", plan: null, framesDone: 0, stage: null, startedAt: null, lastAt: null, output: null, error: null };

const ACTIVE: ExportState["status"][] = ["preparing", "encoding", "finalizing"];

export function exportReducer(state: ExportState, action: ExportAction): ExportState {
  const { status } = state;
  switch (action.type) {
    case "start":
      return ACTIVE.includes(status) ? state : { ...idleExport, status: "preparing" };
    case "stage":
      return status === "preparing" ? { ...state, stage: action.stage } : state;
    case "prepared":
      return status === "preparing" ? { ...state, status: "encoding", plan: action.plan, startedAt: action.at ?? null, lastAt: action.at ?? null } : state;
    case "progress":
      // Nunca regride e nunca passa do total; eventos atrasados depois de cancelar são ignorados.
      return status === "encoding" ? { ...state, framesDone: Math.max(state.framesDone, action.done), lastAt: action.at ?? state.lastAt } : state;
    case "finalizing":
      return status === "encoding" ? { ...state, status: "finalizing" } : state;
    case "finished":
      if (status !== "finalizing") return state;
      // Só vira "done" com todos os quadros escritos; arquivo truncado nunca é sucesso.
      if (action.framesWritten < (state.plan?.totalFrames ?? Infinity)) {
        return { ...state, status: "failed", output: null, error: exportError("incomplete_output") };
      }
      return { ...state, status: "done", framesDone: action.framesWritten, output: action.output };
    case "cancel":
      return ACTIVE.includes(status) ? { ...state, status: "cancelled", output: null } : state;
    case "fail":
      return ACTIVE.includes(status) ? { ...state, status: "failed", output: null, error: action.error } : state;
    case "reset":
      return ACTIVE.includes(status) ? state : idleExport;
  }
}

/** Quadros processados / quadros totais, entre 0 e 1. */
export function progressFraction(state: ExportState): number {
  const total = state.plan?.totalFrames ?? 0;
  return total > 0 ? Math.min(1, state.framesDone / total) : 0;
}

/** Tempo restante em ms pelo ritmo até agora; null no começo, quando a estimativa ainda engana. */
export function remainingMs(state: ExportState): number | null {
  const fraction = progressFraction(state);
  if (state.startedAt === null || state.lastAt === null || fraction < 0.03 || fraction >= 1) return null;
  const elapsed = state.lastAt - state.startedAt;
  return elapsed < 2000 ? null : (elapsed * (1 - fraction)) / fraction;
}

export function formatRemaining(ms: number | null): string | null {
  if (ms === null) return null;
  return ms < 60_000 ? "menos de 1 min" : `cerca de ${Math.round(ms / 60_000)} min`;
}
