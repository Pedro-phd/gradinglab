"use client";

import { useEffect, useRef, useState } from "react";
import { exportFileName, type ExportColor } from "./export-plan";
import type { Snapshot } from "./lut-preview";
import { exportPhoto, PhotoExportCancelled, type Photo } from "./photo";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Status = { kind: "idle" } | { kind: "working"; fraction: number } | { kind: "done"; url: string } | { kind: "failed"; message: string };

type Props = { photo: Photo; name: string; lutName: string | null; color: ExportColor; blocked: string | null; snapshot: () => Snapshot | null };

// Botão "Exportar" da foto e a tela de progresso, no mesmo molde da exportação de vídeo.
export function PhotoExportControl({ photo, name, lutName, color, blocked, snapshot }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [frame, setFrame] = useState<Snapshot | null>(null);
  const controller = useRef<AbortController | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const url = status.kind === "done" ? status.url : null;

  useEffect(() => () => controller.current?.abort(), []);
  // Entrega o arquivo ao terminar; o botão fica para salvar de novo. A URL é liberada ao sair desta tela.
  useEffect(() => {
    if (!url) return;
    link.current?.click();
    return () => URL.revokeObjectURL(url);
  }, [url]);

  function start() {
    const abort = new AbortController();
    controller.current = abort;
    setFrame(snapshot());
    setStatus({ kind: "working", fraction: 0 });
    exportPhoto(photo, color, abort.signal, (fraction) => !abort.signal.aborted && setStatus({ kind: "working", fraction }))
      .then((blob) => !abort.signal.aborted && setStatus({ kind: "done", url: URL.createObjectURL(blob) }))
      .catch((error: unknown) => {
        if (error instanceof PhotoExportCancelled || abort.signal.aborted) return;
        setStatus({ kind: "failed", message: error instanceof Error ? error.message : "Não foi possível exportar a foto." });
      });
  }
  function close() {
    controller.current?.abort();
    setStatus({ kind: "idle" });
  }

  const working = status.kind === "working";
  const percent = status.kind === "done" ? 100 : working ? Math.floor(status.fraction * 100) : 0;

  return (
    <>
      <button type="button" disabled={blocked !== null || working} aria-label={blocked ? `Exportar — ${blocked}` : "Exportar"} onClick={start} className={`flex h-11 items-center rounded-full bg-accent px-[18px] text-[15px] font-semibold text-accent-ink disabled:opacity-40 ${focus}`}>
        Exportar
      </button>

      {status.kind !== "idle" && (
        <div role="dialog" aria-modal="true" aria-labelledby="foto-exportando-titulo" className="fixed inset-0 z-50 overflow-y-auto bg-black">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),34px)] pt-[max(calc(env(safe-area-inset-top)+40px),56px)]">
            {frame && (
              // Quadro capturado da prévia (data URL): next/image não se aplica.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={frame.url} alt="" style={{ aspectRatio: frame.aspect }} className="max-h-[45dvh] max-w-full rounded-[22px] object-contain" />
            )}
            <div className="mt-7 flex flex-col items-center gap-1 text-center">
              <span className="font-display text-[56px] font-bold leading-[60px] tabular-nums text-accent">{percent}%</span>
              <h1 id="foto-exportando-titulo" className="text-[17px] font-semibold">{working ? "Aplicando o look" : status.kind === "done" ? "Pronto" : "A exportação falhou"}</h1>
              <p className="text-[13px] tabular-nums text-muted">JPEG · {photo.width} × {photo.height}</p>
            </div>
            <div role="progressbar" aria-label="Progresso da exportação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-[22px] h-1.5 w-full rounded-full bg-surface-2">
              <div style={{ width: `${percent}%` }} className="h-full rounded-full bg-accent" />
            </div>
            {status.kind === "failed" && <p role="alert" className="mt-5 w-full rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{status.message}</p>}
            <p className="mt-3.5 text-center text-xs leading-[17px] text-muted">{working ? "Mantenha esta tela aberta. Processando neste aparelho; nada é enviado." : "O arquivo original continua intacto."}</p>
            <div className="mt-auto flex w-full flex-col gap-2.5 pt-8">
              {url && (
                <a ref={link} href={url} download={exportFileName(name, lutName, "jpg")} className={`flex h-[52px] items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-accent-ink ${focus}`}>
                  Salvar foto
                </a>
              )}
              <button type="button" autoFocus onClick={close} className={`h-[52px] rounded-full bg-surface text-[17px] font-semibold ${working ? "text-danger" : ""} ${focus}`}>
                {working ? "Cancelar exportação" : "Voltar ao editor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
