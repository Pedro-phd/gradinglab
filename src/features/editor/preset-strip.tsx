"use client";

import type { ReactNode } from "react";
import type { Effects } from "./effects";
import { matchingPreset, PRESETS, type Preset } from "./presets";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Props = {
  effects: Effects;
  /** Miniatura de cada preset (data URL), aplicada sobre o quadro pausado; ausente enquanto gera. */
  thumbs: Record<string, string>;
  enabled: boolean; // perfil confirmado e WebGL2
  notice: ReactNode;
  onPick: (preset: Preset) => void;
};

// Faixa de presets: tocar troca todos os ajustes pelos da receita; o ajuste fino continua em "Ajustes".
export function PresetStrip({ effects, thumbs, enabled, notice, onPick }: Props) {
  const current = matchingPreset(effects);
  return (
    <section aria-label="Presets" className="flex flex-col gap-3.5 pt-4">
      {notice}
      <p className="min-h-11 content-center px-5 text-[15px] text-muted">
        {current ? <>Usando <span className="font-semibold text-foreground">{current.name}</span>. Refine em Ajustes.</> : "Escolha um preset abaixo."}
      </p>
      <ul aria-label="Presets" className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">
        {PRESETS.map((preset) => {
          const selected = preset.id === current?.id;
          const src = thumbs[preset.id];
          return (
            <li key={preset.id} className="snap-start">
              <button type="button" aria-pressed={selected} disabled={!enabled} title={preset.description} onClick={() => onPick(preset)} className={`flex w-16 flex-col items-center gap-1.5 rounded-[14px] disabled:opacity-40 ${focus}`}>
                <span className={`relative block size-16 overflow-hidden rounded-[14px] bg-surface-2 ${selected ? "ring-2 ring-accent" : "ring-1 ring-white/10"}`}>
                  {src ? (
                    // Miniatura gerada no aparelho (data URL): next/image não se aplica.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold text-muted">{preset.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className={`w-full truncate text-center text-[11px] ${selected ? "text-accent" : "text-muted"}`}>{preset.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
