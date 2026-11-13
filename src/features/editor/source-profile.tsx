"use client";

import type { PipelinePlan, ProfileChoice, SourceProfile } from "./color-pipeline";

const OPTIONS: { profile: SourceProfile; label: string }[] = [
  { profile: "apple-log", label: "Apple Log" },
  { profile: "normal", label: "Normal" },
  { profile: "unknown", label: "Não sei" },
];

function describe(profile: SourceProfile, lutExpectsLog: boolean): string {
  if (profile === "apple-log") {
    return lutExpectsLog
      ? "Apple Log: a LUT recebe o Log sem conversão. O “antes” e a base da intensidade continuam sendo a imagem convertida para Rec.709."
      : "Apple Log é convertido para Rec.709 antes do look. Essa imagem normalizada é o “antes”. Áreas muito claras acima do branco do Rec.709 ficam brancas.";
  }
  if (profile === "normal") return "Gravação normal: nenhuma conversão de Log é aplicada antes do look.";
  return "Perfil não confirmado. Escolha Apple Log ou Normal para aplicar o look com a base correta.";
}

type Props = {
  choice: ProfileChoice;
  plan: PipelinePlan;
  lutExpectsLog: boolean;
  hdr: boolean; // o navegador indicou HDR no quadro
  disabled: boolean;
  onChoose: (profile: SourceProfile) => void;
};

export function SourceProfileSection({ choice, plan, lutExpectsLog, hdr, disabled, onChoose }: Props) {
  return (
    <section aria-labelledby="origem-titulo" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="origem-titulo" className="font-display text-[15px] font-semibold">Origem do vídeo</h2>
        <span className="text-xs text-muted">{choice.source === "none" ? "o navegador não informou" : choice.profile === "unknown" ? "perfil não confirmado" : "escolhido por você"}</span>
      </div>
      <div role="group" aria-label="Perfil de cor da origem" className="flex gap-1 rounded-full bg-black/30 p-1">
        {OPTIONS.map(({ profile, label }) => (
          <button
            key={profile}
            type="button"
            aria-pressed={choice.profile === profile}
            disabled={disabled}
            onClick={() => onChoose(profile)}
            className={`h-11 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${choice.profile === profile ? "bg-accent text-accent-ink" : "text-foreground hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[13px] leading-normal text-foreground/80">{describe(choice.profile, lutExpectsLog)}</p>
      {plan.requiresConfirmation && <p role="status" className="text-xs text-muted">O look só é aplicado depois que você confirmar o perfil.</p>}
      {hdr && (
        <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
          O navegador indica que este vídeo é HDR. Não há suporte garantido: a prévia pode não ficar correta.
        </p>
      )}
    </section>
  );
}
