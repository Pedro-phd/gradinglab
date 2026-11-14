// Tela inicial (escolher vídeo) e a de conversão local, no mesmo molde de tela cheia.
import type { ReactNode } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const STEPS = ["Escolha o vídeo", "Empilhe looks e ajuste a força", "Exporte em MP4 com áudio"];

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-5 pb-[max(env(safe-area-inset-bottom),34px)] pt-[max(calc(env(safe-area-inset-top)+40px),64px)]">
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">GradingLab</p>
      {children}
    </div>
  );
}

/** inputId: o input de arquivo fica fora daqui, no editor; o rótulo grande abre o seletor do aparelho. */
export function HomeScreen({ inputId, error }: { inputId: string; error: { message: string; attempt: number } | null }) {
  return (
    <Shell>
      <Title>
        <h1 className="font-display text-[34px] font-bold leading-10">Dê cor ao seu vídeo</h1>
        <p className="text-[15px] leading-[21px] text-muted">Tudo roda neste aparelho. Nada é enviado.</p>
      </Title>

      {error && <p key={error.attempt} role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error.message}</p>}

      <label
        htmlFor={inputId}
        className="flex h-[300px] cursor-pointer flex-col items-center justify-center gap-3.5 rounded-[28px] border border-dashed border-white/20 bg-surface active:bg-surface-2 group-has-[#video-input:focus-visible]:outline-2 group-has-[#video-input:focus-visible]:outline-offset-2 group-has-[#video-input:focus-visible]:outline-white"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <span className="text-[17px] font-semibold">{error ? "Tentar outro vídeo" : "Escolher vídeo"}</span>
        <span className="text-[13px] text-muted">Fotos ou Arquivos · MOV, MP4 · Apple Log</span>
      </label>

      <ol className="overflow-hidden rounded-2xl bg-surface">
        {STEPS.map((step, index) => (
          <li key={step} className="flex min-h-14 items-center gap-3.5 border-b border-white/10 px-4 last:border-b-0">
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-accent">{index + 1}</span>
            <span className="text-[15px]">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /></svg>
        <p className="text-[13px] leading-[18px] text-muted">O arquivo original nunca é alterado.</p>
      </div>
    </Shell>
  );
}

export function ConvertingScreen({ name, progress, onCancel }: { name: string; progress: number; onCancel: () => void }) {
  const percent = Math.round(progress * 100);
  return (
    <Shell>
      <Title>
        <h1 className="font-display text-[34px] font-bold leading-10">Convertendo o vídeo</h1>
        <p className="text-[15px] leading-[21px] text-muted">
          Este navegador não abre o formato de <strong className="font-semibold text-foreground">{name}</strong> (ex.: ProRes). Uma cópia em H.264 está sendo gerada aqui no seu aparelho; nada é enviado. Pode levar alguns minutos.
        </p>
      </Title>
      <div className="flex flex-col items-center gap-5 rounded-[28px] bg-surface px-6 py-10">
        <span className="font-display text-[56px] font-bold leading-[60px] tabular-nums text-accent">{percent}%</span>
        <div role="progressbar" aria-label="Conversão do vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 w-full rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-center text-xs text-muted">Mantenha esta tela aberta.</p>
      </div>
      <button type="button" onClick={onCancel} className={`mt-auto h-[52px] rounded-full bg-surface text-[17px] font-semibold text-danger ${focus}`}>Cancelar</button>
    </Shell>
  );
}
