import type { ExportState } from "./export-state";
import { progressFraction } from "./export-state";

const TITLES: Partial<Record<ExportState["status"], string>> = {
  preparing: "Preparando a exportação",
  encoding: "Aplicando o look",
  finalizing: "Finalizando o arquivo",
};

type Props = { state: ExportState; summary: string; onCancel: () => void };

// Tela de progresso: cobre a página enquanto a exportação roda. Cancelar descarta tudo.
export function ExportProgress({ state, summary, onCancel }: Props) {
  const percent = Math.floor(progressFraction(state) * 100);
  const { plan } = state;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="exportando-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-background/85 p-3 backdrop-blur-sm md:items-center">
      <section className="flex w-full max-w-md flex-col gap-5 rounded-[32px] border border-white/10 bg-[rgb(40_38_34/.9)] p-5 pt-6 backdrop-blur-xl">
        <div className="flex flex-col gap-1.5">
          <p className="truncate text-[13px] text-foreground/80">{summary}</p>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="exportando-titulo" className="font-display text-[22px] font-semibold leading-tight">{TITLES[state.status] ?? "Exportando"}</h2>
            <span className="font-display text-[44px] font-semibold leading-none tabular-nums text-accent">{percent}%</span>
          </div>
        </div>
        <div role="progressbar" aria-label="Progresso da exportação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2.5 overflow-hidden rounded-full bg-white/15">
          <div style={{ width: `${percent}%` }} className="h-full rounded-full bg-accent" />
        </div>
        <p className="text-[13px] tabular-nums text-muted">{plan ? `Quadro ${state.framesDone} de ${plan.totalFrames}` : (state.stage ?? "Iniciando…")}</p>
        <ul className="flex flex-col gap-3 text-sm leading-snug text-foreground/90">
          <li>Processando neste aparelho. Nada é enviado.</li>
          <li>{plan?.audio === "none" ? "Duração, proporção e orientação preservadas. O vídeo não tem áudio." : "Duração, áudio, proporção e orientação preservados."}</li>
          <li>O arquivo original continua intacto.</li>
          {plan?.tenBit && <li className="rounded-2xl bg-amber-500/15 px-3 py-2 text-amber-200">Este vídeo parece ter 10 bits por canal. A saída tem 8 bits.</li>}
        </ul>
        {plan && (
          <ul aria-label="O que sai no arquivo" className="flex flex-wrap gap-2 text-xs">
            {["MP4 · H.264 (SDR)", `Resolução original · ${plan.width} × ${plan.height}`, plan.audio === "copy" ? "Áudio preservado" : "Sem áudio"].map((text) => (
              <li key={text} className="rounded-full bg-black/30 px-3 py-2">{text}</li>
            ))}
          </ul>
        )}
        <p className="text-[13px] leading-normal text-muted">Mantenha esta tela aberta até terminar. Se o aparelho não tiver recursos para concluir, você será avisado do motivo.</p>
        <button type="button" autoFocus onClick={onCancel} className="h-[52px] rounded-full border border-white/30 text-base font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Cancelar exportação
        </button>
      </section>
    </div>
  );
}
