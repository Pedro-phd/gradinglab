"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { ExportRequest } from "./export-video";
import { exportError, type ExportColor } from "./export-plan";
import { exportReducer, idleExport, type ExportAction } from "./export-state";

const STALE_MS = 24 * 60 * 60 * 1000;

// Gravação incremental: arquivo temporário privado do site (OPFS), apagado depois do download, de cancelar ou de falhar.
export function hasIncrementalStorage(): boolean {
  return typeof FileSystemFileHandle !== "undefined" && "createWritable" in FileSystemFileHandle.prototype && typeof navigator.storage?.getDirectory === "function";
}

async function openTempFile(): Promise<{ handle: FileSystemFileHandle; remove: () => void } | null> {
  if (!hasIncrementalStorage()) return null;
  try {
    const dir = await navigator.storage.getDirectory();
    // Sobras de abas fechadas no meio da exportação: o nome traz a hora de criação.
    for await (const key of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) { // keys() não está nos tipos DOM deste projeto
      if (/^export-(\d+)-/.test(key) && Date.now() - Number(key.split("-")[1]) > STALE_MS) await dir.removeEntry(key).catch(() => undefined);
    }
    const name = `export-${Date.now()}-${crypto.randomUUID()}.mp4`;
    const handle = await dir.getFileHandle(name, { create: true });
    return { handle, remove: () => void dir.removeEntry(name).catch(() => undefined) };
  } catch {
    return null;
  }
}

export function useExport() {
  const [state, dispatch] = useReducer(exportReducer, idleExport);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const job = useRef<{ cancel: () => void; cleanup: () => void } | null>(null);

  function release() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setDownloadUrl(null);
    job.current?.cleanup();
    job.current = null;
  }
  // Sair da tela durante a exportação também a interrompe; a URL local é liberada.
  useEffect(() => () => {
    job.current?.cancel();
    job.current?.cleanup();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function start(file: File, color: ExportColor) {
    release();
    dispatch({ type: "start" });
    const temp = await openTempFile();
    const request: ExportRequest = { file, color, handle: temp?.handle ?? null };
    const controller = new AbortController();
    let worker: Worker | null = null;
    const emit = (action: ExportAction) => {
      dispatch(action);
      if (action.type === "finished") {
        urlRef.current = URL.createObjectURL(action.output.blob);
        setDownloadUrl(urlRef.current);
      }
      if (action.type === "finished" || action.type === "fail" || action.type === "cancel") worker?.terminate();
      if (action.type === "fail" || action.type === "cancel") temp?.remove();
    };
    job.current = {
      // A tela volta na hora; o worker confirma com "cancel" depois de fechar tudo e descartar os dados parciais.
      cancel: () => {
        dispatch({ type: "cancel" });
        if (worker) worker.postMessage("cancel");
        else controller.abort();
      },
      cleanup: () => temp?.remove(),
    };
    if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
      worker = new Worker(new URL("./export-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<ExportAction>) => emit(event.data);
      worker.onerror = () => emit({ type: "fail", error: exportError("export_failed") });
      worker.postMessage(request);
    } else {
      // Sem Worker ou OffscreenCanvas: a mesma exportação na thread principal.
      const { runExport } = await import("./export-video");
      void runExport(request, controller.signal, emit);
    }
  }

  return {
    state,
    downloadUrl,
    start,
    cancel: () => job.current?.cancel(),
    reset: () => {
      release();
      dispatch({ type: "reset" });
    },
  };
}
