"use client";

import { useEffect, useRef, useState } from "react";
import { exportFileName, needsMemoryWarning, type ExportColor } from "./export-plan";
import { formatRemaining, progressFraction, remainingMs, type ExportState } from "./export-state";
import type { Snapshot } from "./lut-preview";
import { hasIncrementalStorage, useExport } from "./use-export";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const TITLES: Partial<Record<ExportState["status"], string>> = {
  preparing: "Preparando a exportação",
  encoding: "Aplicando o look",
  finalizing: "Finalizando o arquivo",
  done: "Pronto",
  failed: "A exportação falhou",
};

type Props = {
  file: File;
  lutName: string | null; // vai no nome do arquivo: a última LUT da pilha (o look)
  color: ExportColor;
  blocked: string | null; // por que ainda não dá para exportar
  /** Quadro atual da prévia, com o look, para a tela de progresso. */
  snapshot: () => Snapshot | null;
};

// Botão "Exportar" do topo e a tela cheia de progresso. Exporta o "depois" com o perfil,
// as LUTs e as intensidades que a prévia está usando agora.
export function ExportControl({ file, lutName, color, blocked, snapshot }: Props) {
  const { state, downloadUrl, start, cancel, reset } = useExport();
  const [frame, setFrame] = useState<Snapshot | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const active = state.status === "preparing" || state.status === "encoding" || state.status === "finalizing";
  const visible = active || state.status === "done" || state.status === "failed";

  // Entrega o arquivo ao terminar; o botão fica na tela para salvar de novo (alguns navegadores bloqueiam o automático).
  useEffect(() => {
    if (state.status === "done") link.current?.click();
  }, [state.status]);

  const fraction = state.status === "done" ? 1 : progressFraction(state);
  const percent = Math.floor(fraction * 100);
  const { plan } = state;
  const eta = formatRemaining(remainingMs(state));
  const detail = plan ? `Quadro ${state.framesDone.toLocaleString("pt-BR")} de ${plan.totalFrames.toLocaleString("pt-BR")}${eta && active ? ` · ${eta}` : ""}` : (state.stage ?? "Iniciando…");

  return (
    <>
      <button
        type="button"
        disabled={blocked !== null || active}
        aria-label={blocked ? `Exportar — ${blocked}` : "Exportar"}
        onClick={() => {
          setFrame(snapshot());
          void start(file, color);
        }}
        className={`flex h-11 items-center rounded-full bg-accent px-[18px] text-[15px] font-semibold text-accent-ink disabled:opacity-40 ${focus}`}
      >
        Exportar
      </button>

      {visible && (
        <div role="dialog" aria-modal="true" aria-labelledby="exportando-titulo" className="fixed inset-0 z-50 overflow-y-auto bg-black">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),34px)] pt-[max(calc(env(safe-area-inset-top)+40px),56px)]">
            <div style={{ aspectRatio: frame?.aspect ?? 9 / 16, width: (frame?.aspect ?? 0) >= 1 ? "100%" : "196px" }} className="relative max-w-full overflow-hidden rounded-[22px] bg-surface-2">
              {frame && (
                // Quadro capturado da prévia (data URL): next/image não se aplica.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame.url} alt="" className="h-full w-full object-cover" />
              )}
              <div aria-hidden="true" style={{ height: `${100 - percent}%` }} className="absolute inset-x-0 bottom-0 bg-black/50 motion-safe:transition-[height] motion-safe:duration-300" />
            </div>

            <div className="mt-7 flex flex-col items-center gap-1 text-center">
              <span className="font-display text-[56px] font-bold leading-[60px] tabular-nums text-accent">{percent}%</span>
              <h1 id="exportando-titulo" className="text-[17px] font-semibold">{TITLES[state.status] ?? "Exportando"}</h1>
              {state.status === "done" ? (
                <p className="text-[13px] text-muted">O vídeo com o look foi gerado.</p>
              ) : state.status === "failed" ? null : (
                <p className="text-[13px] tabular-nums text-muted">{detail}</p>
              )}
            </div>

            <div role="progressbar" aria-label="Progresso da exportação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-[22px] h-1.5 w-full rounded-full bg-surface-2">
              <div style={{ width: `${percent}%` }} className="h-full rounded-full bg-accent" />
            </div>

            {state.status === "failed" && state.error && (
              <p role="alert" className="mt-5 w-full rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {state.error.message}
                {state.error.detail && <span className="mt-2 block break-words text-xs text-red-200/70">Detalhe técnico: {state.error.detail}</span>}
              </p>
            )}

            <ul className="mt-[22px] w-full overflow-hidden rounded-2xl bg-surface">
              {[
                ["Formato", "MP4 · H.264"],
                ["Resolução", plan ? `${plan.width} × ${plan.height}` : "Original"],
                ["Áudio", plan?.audio === "none" ? "O vídeo não tem áudio" : "Preservado"],
              ].map(([key, value]) => (
                <li key={key} className="flex min-h-11 items-center justify-between border-b border-white/10 px-4 text-[15px] last:border-b-0">
                  <span className="text-muted">{key}</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
            {plan?.tenBit && <p className="mt-3 w-full rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">Este vídeo parece ter 10 bits por canal. A saída tem 8 bits.</p>}
            {active && needsMemoryWarning(file.size, hasIncrementalStorage()) && (
              <p className="mt-3 w-full rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">Este navegador não grava a saída em disco durante a exportação. Com um vídeo deste tamanho a memória pode acabar; se isso acontecer você será avisado.</p>
            )}

            <p className="mt-3.5 text-center text-xs leading-[17px] text-muted">
              {active ? "Mantenha esta tela aberta. Processando neste aparelho; nada é enviado." : "O arquivo original continua intacto."}
            </p>

            <div className="mt-auto flex w-full flex-col gap-2.5 pt-8">
              {state.status === "done" && downloadUrl && (
                <a ref={link} href={downloadUrl} download={exportFileName(file.name, lutName)} className={`flex h-[52px] items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-accent-ink ${focus}`}>
                  Salvar vídeo
                </a>
              )}
              {active ? (
                <button type="button" autoFocus onClick={cancel} className={`h-[52px] rounded-full bg-surface text-[17px] font-semibold text-danger ${focus}`}>Cancelar exportação</button>
              ) : (
                <button type="button" autoFocus onClick={reset} className={`h-[52px] rounded-full bg-surface text-[17px] font-semibold ${focus}`}>Voltar ao editor</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
