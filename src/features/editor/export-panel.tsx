"use client";

import { useEffect, useRef } from "react";
import { exportError, exportFileName, needsMemoryWarning, type ExportColor } from "./export-plan";
import { ExportProgress } from "./export-progress";
import { hasIncrementalStorage, useExport } from "./use-export";

type Props = {
  file: File;
  lutName: string | null; // vai no nome do arquivo: a última LUT da pilha (o look)
  summary: string; // pilha e intensidade, para o progresso
  color: ExportColor;
  blocked: string | null; // por que ainda não dá para exportar (sem LUT, perfil não confirmado, sem WebGL2)
};

// Exporta o "depois" com o perfil, a LUT e a intensidade que a prévia está usando agora.
export function ExportSection({ file, lutName, summary, color, blocked }: Props) {
  const { state, downloadUrl, start, cancel } = useExport();
  const link = useRef<HTMLAnchorElement>(null);
  const active = state.status === "preparing" || state.status === "encoding" || state.status === "finalizing";
  const webCodecs = typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";

  // Entrega o arquivo ao terminar; o link fica na tela para baixar de novo (alguns navegadores bloqueiam o download automático).
  useEffect(() => {
    if (state.status === "done") link.current?.click();
  }, [state.status]);

  return (
    <section aria-labelledby="exportar-titulo" className="flex flex-col gap-3">
      <h2 id="exportar-titulo" className="font-display text-[15px] font-semibold">Exportar</h2>
      {state.status === "failed" && state.error && <p role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{state.error.message}</p>}
      {state.status === "cancelled" && <p role="status" className="rounded-2xl bg-white/10 px-4 py-3 text-sm">Exportação cancelada. Nada foi baixado e o vídeo original continua aberto.</p>}
      {state.status === "done" && downloadUrl && (
        <p role="status" className="rounded-2xl bg-accent/15 px-4 py-3 text-sm">
          Pronto. O vídeo com o look foi gerado.{" "}
          <a ref={link} href={downloadUrl} download={exportFileName(file.name, lutName)} className="font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Baixar de novo</a>
        </p>
      )}
      {!webCodecs ? (
        <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">{exportError("webcodecs_unavailable").message}</p>
      ) : (
        <>
          {needsMemoryWarning(file.size, hasIncrementalStorage()) && (
            <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">Este navegador não grava a saída em disco durante a exportação. Com um vídeo deste tamanho a memória pode acabar; se isso acontecer você será avisado.</p>
          )}
          <button
            type="button"
            disabled={blocked !== null || active}
            onClick={() => void start(file, color)}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-accent text-base font-semibold text-accent-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>
            Baixar vídeo com o look
          </button>
          {blocked && <p className="text-center text-xs text-muted">{blocked}</p>}
        </>
      )}
      <p className="text-center text-xs leading-normal text-muted">MP4 na resolução original, com o áudio. O arquivo original não é alterado nem enviado.</p>
      {active && <ExportProgress state={state} summary={`${file.name} · ${summary}`} onCancel={cancel} />}
    </section>
  );
}
