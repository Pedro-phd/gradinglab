"use client";

import type { PipelinePlan, ProfileChoice, SourceProfile } from "./color-pipeline";
import type { CompareMode } from "./compare";
import { Sheet, SheetDone } from "./sheet";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const OPTIONS: { profile: SourceProfile; label: string }[] = [
  { profile: "apple-log", label: "Apple Log" },
  { profile: "normal", label: "Normal" },
  { profile: "unknown", label: "Não sei" },
];

/** Rótulo do botão de origem no topo do editor. */
export function profileLabel(profile: SourceProfile): string {
  return profile === "unknown" ? "Origem?" : OPTIONS.find((option) => option.profile === profile)!.label;
}

function describe(profile: SourceProfile, lutExpectsLog: boolean): string {
  if (profile === "apple-log") {
    return lutExpectsLog
      ? "Apple Log: a 1ª LUT recebe o Log sem conversão e faz a conversão. O “antes” e a base da intensidade continuam sendo a imagem convertida para Rec.709."
      : "Apple Log é convertido para Rec.709 pela LUT oficial da Apple antes do look. Essa imagem convertida é o “antes”.";
  }
  if (profile === "normal") return "Gravação normal: nenhuma conversão de Log é aplicada antes do look.";
  return "Perfil não confirmado. Escolha Apple Log ou Normal para aplicar o look com a base correta.";
}

type OriginProps = {
  open: boolean;
  onClose: () => void;
  choice: ProfileChoice;
  plan: PipelinePlan;
  lutExpectsLog: boolean;
  hdr: boolean; // o navegador indicou HDR no quadro
  disabled: boolean;
  onChoose: (profile: SourceProfile) => void;
  video: { name: string; details: string };
  onPickAnother: () => void;
};

export function OriginSheet({ open, onClose, choice, plan, lutExpectsLog, hdr, disabled, onChoose, video, onPickAnother }: OriginProps) {
  const source = choice.source === "none" ? "o navegador não informou" : choice.source === "metadata" ? "detectado no arquivo" : choice.profile === "unknown" ? "perfil não confirmado" : "escolhido por você";
  return (
    <Sheet open={open} onClose={onClose} title="Origem do vídeo" titleId="origem-titulo" action={<SheetDone onClick={onClose} />}>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <p className="px-1 text-[13px] text-muted">{source}</p>
        <div role="group" aria-label="Perfil de cor da origem" className="flex gap-0.5 rounded-[12px] bg-surface-2 p-0.5">
          {OPTIONS.map(({ profile, label }) => (
            <button
              key={profile}
              type="button"
              aria-pressed={choice.profile === profile}
              disabled={disabled}
              onClick={() => onChoose(profile)}
              className={`h-11 flex-1 whitespace-nowrap rounded-[10px] px-2 text-[15px] font-semibold disabled:opacity-40 ${choice.profile === profile ? "bg-accent text-accent-ink" : "text-foreground"} ${focus}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="px-1 text-[13px] leading-[18px] text-foreground/80">{describe(choice.profile, lutExpectsLog)}</p>
        {plan.requiresConfirmation && <p role="status" className="px-1 text-xs text-muted">O look só é aplicado depois que você confirmar o perfil.</p>}
        {hdr && <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">O navegador indica que este vídeo é HDR. Não há suporte garantido: a prévia pode não ficar correta.</p>}

        <div className="mt-2 overflow-hidden rounded-2xl bg-surface-2">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-[15px] font-semibold">{video.name}</p>
            <p className="text-[13px] text-muted">{video.details}</p>
          </div>
          <button type="button" onClick={onPickAnother} className={`flex h-12 w-full items-center px-4 text-[15px] font-semibold text-accent ${focus}`}>Escolher outro vídeo</button>
        </div>
      </div>
    </Sheet>
  );
}

const MODES: { mode: CompareMode; label: string; hint: string }[] = [
  { mode: "compare", label: "Antes / depois", hint: "Divisor sobre a imagem" },
  { mode: "result", label: "Só o resultado", hint: "O vídeo com o look" },
  { mode: "original", label: "Original", hint: "O quadro como veio, sem conversão" },
];

export function CompareSheet({ open, onClose, mode, onChange }: { open: boolean; onClose: () => void; mode: CompareMode; onChange: (mode: CompareMode) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Comparar" titleId="comparar-titulo" action={<SheetDone onClick={onClose} />}>
      <div role="group" aria-label="Modo de comparação" className="mx-4 mb-6 overflow-hidden rounded-2xl bg-surface-2">
        {MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            aria-pressed={mode === item.mode}
            onClick={() => {
              onChange(item.mode);
              onClose();
            }}
            className={`flex min-h-14 w-full items-center justify-between gap-3 border-b border-white/10 px-4 text-left last:border-b-0 ${focus}`}
          >
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{item.label}</span>
              <span className="text-[13px] text-muted">{item.hint}</span>
            </span>
            {mode === item.mode && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
