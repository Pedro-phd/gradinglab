import { describe, expect, it } from "vitest";
import type { ExportSummary } from "./export-plan";
import { exportReducer, idleExport, progressFraction, type ExportAction, type ExportState } from "./export-state";

const plan: ExportSummary = {
  container: "mp4", videoCodec: "avc", width: 1920, height: 1080, rotation: 0, frameRate: 30,
  durationSeconds: 33.3, totalFrames: 1000, audio: "copy", hdr: false, tenBit: false,
};
const output = { blob: new Blob(["x"]) };

function run(...actions: ExportAction[]): ExportState {
  return actions.reduce(exportReducer, idleExport);
}
const encoding = (): ExportAction[] => [{ type: "start" }, { type: "prepared", plan }];

describe("máquina de estados da exportação", () => {
  it("segue idle → preparing → encoding → finalizing → done", () => {
    expect(idleExport.status).toBe("idle");
    expect(run({ type: "start" }).status).toBe("preparing");
    expect(run(...encoding()).status).toBe("encoding");
    expect(run(...encoding(), { type: "progress", done: 1000 }, { type: "finalizing" }).status).toBe("finalizing");
    const done = run(...encoding(), { type: "progress", done: 1000 }, { type: "finalizing" }, { type: "finished", framesWritten: 1000, output });
    expect(done.status).toBe("done");
    expect(done.output).toBe(output);
  });

  it("progresso é quadros processados / quadros totais, entre 0 e 1, e nunca regride", () => {
    expect(progressFraction(run(...encoding(), { type: "progress", done: 370 }))).toBe(0.37);
    const state = run(...encoding(), { type: "progress", done: 500 }, { type: "progress", done: 400 });
    expect(progressFraction(state)).toBe(0.5);
    expect(progressFraction(run(...encoding(), { type: "progress", done: 5000 }))).toBe(1);
    expect(progressFraction(idleExport)).toBe(0);
  });

  it("cancelar em qualquer etapa leva a 'cancelled' e não gera arquivo", () => {
    const steps: ExportAction[][] = [
      [{ type: "start" }],
      encoding(),
      [...encoding(), { type: "progress", done: 10 }, { type: "finalizing" }],
    ];
    for (const prefix of steps) {
      const state = run(...prefix, { type: "cancel" });
      expect(state.status).toBe("cancelled");
      expect(state.output).toBeNull();
    }
  });

  it("depois de cancelar, eventos atrasados do processamento são ignorados", () => {
    const state = run(...encoding(), { type: "cancel" }, { type: "progress", done: 900 }, { type: "finalizing" }, { type: "finished", framesWritten: 1000, output });
    expect(state.status).toBe("cancelled");
    expect(state.output).toBeNull();
  });

  it("falha no meio leva a 'failed' com motivo e não gera arquivo parcial", () => {
    const state = run(...encoding(), { type: "progress", done: 300 }, { type: "fail", error: { code: "export_failed", message: "Falhou." } });
    expect(state.status).toBe("failed");
    expect(state.output).toBeNull();
    expect(state.error?.code).toBe("export_failed");
  });

  it("só chega a 'done' quando todos os quadros foram escritos", () => {
    const state = run(...encoding(), { type: "progress", done: 999 }, { type: "finalizing" }, { type: "finished", framesWritten: 999, output });
    expect(state.status).toBe("failed");
    expect(state.error?.code).toBe("incomplete_output");
    expect(state.output).toBeNull();
  });

  it("permite exportar de novo depois de terminar, cancelar ou falhar", () => {
    for (const end of [{ type: "cancel" }, { type: "fail", error: { code: "export_failed", message: "x" } }] as ExportAction[]) {
      expect(run(...encoding(), end, { type: "start" }).status).toBe("preparing");
    }
    expect(run(...encoding(), { type: "cancel" }, { type: "reset" })).toEqual(idleExport);
  });

  it("não inicia outra exportação enquanto uma está em andamento", () => {
    const state = run(...encoding());
    expect(exportReducer(state, { type: "start" })).toBe(state);
  });
});
