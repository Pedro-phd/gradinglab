// Máquina de estados da exportação, pura: o hook só traduz os eventos do processamento em ações.
import { exportError, type ExportError, type ExportSummary } from "./export-plan";

export type ExportOutput = { blob: Blob };

export type ExportState = {
  status: "idle" | "preparing" | "encoding" | "finalizing" | "done" | "cancelled" | "failed";
  plan: ExportSummary | null;
  framesDone: number;
  /** Só existe em "done": cancelar ou falhar nunca deixa arquivo. */
  output: ExportOutput | null;
  error: ExportError | null;
};

export type ExportAction =
  | { type: "start" }
  | { type: "prepared"; plan: ExportSummary }
  | { type: "progress"; done: number }
  | { type: "finalizing" }
  | { type: "finished"; framesWritten: number; output: ExportOutput }
  | { type: "cancel" }
  | { type: "fail"; error: ExportError }
  | { type: "reset" };

export const idleExport: ExportState = { status: "idle", plan: null, framesDone: 0, output: null, error: null };

const ACTIVE: ExportState["status"][] = ["preparing", "encoding", "finalizing"];

export function exportReducer(state: ExportState, action: ExportAction): ExportState {
  const { status } = state;
  switch (action.type) {
    case "start":
      return ACTIVE.includes(status) ? state : { ...idleExport, status: "preparing" };
    case "prepared":
      return status === "preparing" ? { ...state, status: "encoding", plan: action.plan } : state;
    case "progress":
      // Nunca regride e nunca passa do total; eventos atrasados depois de cancelar são ignorados.
      return status === "encoding" ? { ...state, framesDone: Math.max(state.framesDone, action.done) } : state;
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
