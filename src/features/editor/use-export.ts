"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { ExportRequest } from "./export-video";
import { exportError, withTimeout, type ExportColor } from "./export-plan";
import { exportReducer, idleExport, type ExportAction } from "./export-state";

const STALE_MS = 24 * 60 * 60 * 1000;

// Gravação incremental: arquivo temporário privado do site (OPFS), apagado depois do download, de cancelar ou de falhar.
export function hasIncrementalStorage(): boolean {
  return typeof FileSystemFileHandle !== "undefined" && "createWritable" in FileSystemFileHandle.prototype && typeof navigator.storage?.getDirectory === "function";
}

async function openTempFile(): Promise<TempFile | null> {
  if (!hasIncrementalStorage()) return null;
  return withTimeout(openTempFileUnsafe(), 5000);
}

async function openTempFileUnsafe(): Promise<TempFile | null> {
  try {
    const dir = await navigator.storage.getDirectory();
    // Sobras de abas fechadas no meio da exportação: o nome traz a hora de criação.
    for await (const key of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) { // keys() não está nos tipos DOM deste projeto
      if (/^export-(\d+)-/.test(key) && Date.now() - Number(key.split("-")[1]) > STALE_MS) await dir.removeEntry(key).catch(() => undefined);
    }
    const name = `export-${Date.now()}-${crypto.randomUUID()}.mp4`;
    await dir.getFileHandle(name, { create: true });
    return { name, remove: () => void dir.removeEntry(name).catch(() => undefined) };
  } catch {
    return null;
  }
}

type TempFile = { name: string; remove: () => void };
type Job = { controller: AbortController; worker: Worker | null; temp: TempFile | null; active: boolean; cancelled: boolean; retried: boolean };

export function useExport() {
  const [state, dispatch] = useReducer(exportReducer, idleExport);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const job = useRef<Job | null>(null);

  // Libera a URL e o temporário de uma exportação terminada. Uma ainda ativa (cancelando) se limpa sozinha ao confirmar.
  function release() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setDownloadUrl(null);
    if (job.current && !job.current.active) job.current.temp?.remove();
    job.current = null;
  }
  function cancelJob(mine: Job) {
    if (!mine.active || mine.cancelled) return;
    mine.cancelled = true;
    dispatch({ type: "cancel" }); // a tela volta na hora; o temporário só some quando o worker confirma
    mine.controller.abort();
    mine.worker?.postMessage("cancel");
  }
  // Sair da tela durante a exportação também a interrompe; a URL local é liberada.
  useEffect(() => () => {
    if (job.current?.active) cancelJob(job.current);
    else job.current?.temp?.remove();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function start(file: File, color: ExportColor) {
    release();
    dispatch({ type: "start" });
    // O job e o AbortController existem antes de qualquer await: cancelar na fase inicial já vale.
    const mine: Job = { controller: new AbortController(), worker: null, temp: null, active: true, cancelled: false, retried: false };
    job.current = mine;
    const emit = (incoming: ExportAction) => {
      // Carimba o relógio aqui (thread principal) para a estimativa de tempo restante.
      const action: ExportAction = incoming.type === "prepared" || incoming.type === "progress" ? { ...incoming, at: performance.now() } : incoming;
      // Sem WebGL2 no worker: tenta uma vez na thread principal (o worker já apagou o temporário).
      if (action.type === "fail" && action.error.code === "webgl_unavailable" && mine.worker && !mine.retried && !mine.cancelled) {
        mine.retried = true;
        mine.worker.terminate();
        mine.worker = null;
        void launch(false);
        return;
      }
      // Sucesso só com a exportação ainda valendo; cancelada no último instante, nada de URL nem de arquivo.
      const keep = action.type === "finished" && job.current === mine && !mine.cancelled;
      if (job.current === mine && (keep || action.type !== "finished")) {
        if (action.type === "finished") {
          urlRef.current = URL.createObjectURL(action.output.blob);
          setDownloadUrl(urlRef.current);
        }
        dispatch(action);
      }
      if (action.type !== "finished" && action.type !== "fail" && action.type !== "cancel") return;
      mine.active = false;
      mine.worker?.terminate();
      if (!keep) mine.temp?.remove(); // runExport já apagou; aqui só cobre worker que caiu
    };
    // Qualquer falha ao iniciar (worker, cópia do pedido) vira erro na tela, nunca um 0% parado.
    const launch = (inWorker: boolean) => launchUnsafe(inWorker).catch((error: unknown) => emit({ type: "fail", error: exportError("export_failed", `ao iniciar — ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`) }));
    async function launchUnsafe(inWorker: boolean) {
      dispatch({ type: "stage", stage: "Abrindo o armazenamento local…" });
      mine.temp = await openTempFile();
      if (mine.controller.signal.aborted) {
        mine.temp?.remove();
        mine.active = false;
        return;
      }
      const request: ExportRequest = { file, color, tempName: mine.temp?.name ?? null };
      if (inWorker && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
        const worker = new Worker(new URL("./export-worker.ts", import.meta.url), { type: "module" });
        mine.worker = worker;
        worker.onmessage = (event: MessageEvent<ExportAction>) => emit(event.data);
        worker.onerror = (event) => emit({ type: "fail", error: exportError("export_failed", `worker — ${event.message || "erro sem mensagem"}`) });
        worker.postMessage(request);
      } else {
        // Sem Worker ou OffscreenCanvas (ou depois de o worker não achar WebGL2): a mesma exportação na thread principal.
        const { runExport } = await import("./export-video");
        void runExport(request, mine.controller.signal, emit);
      }
    }
    await launch(true);
  }

  return {
    state,
    downloadUrl,
    start,
    cancel: () => job.current && cancelJob(job.current),
    reset: () => {
      release();
      dispatch({ type: "reset" });
    },
  };
}
