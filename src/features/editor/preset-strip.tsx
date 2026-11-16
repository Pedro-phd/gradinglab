"use client";

import type { ReactNode } from "react";
import type { Effects } from "./effects";
import { matchingPreset, PRESETS, type Preset } from "./presets";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Props = {
  effects: Effects;
  enabled: boolean; // perfil confirmado e WebGL2
  notice: ReactNode;
  onPick: (preset: Preset) => void;
};

// Faixa de presets: tocar troca todos os ajustes pelos da receita; o ajuste fino continua em "Ajustes".
export function PresetStrip({ effects, enabled, notice, onPick }: Props) {
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
          return (
            <li key={preset.id} className="snap-start">
              <button
                type="button"
                aria-pressed={selected}
                disabled={!enabled}
                onClick={() => onPick(preset)}
                className={`flex h-[72px] w-32 flex-col justify-center gap-1 rounded-[14px] bg-surface px-3 text-left disabled:opacity-40 ${selected ? "ring-2 ring-accent" : "ring-1 ring-white/10"} ${focus}`}
              >
                <span className={`truncate text-[13px] font-semibold ${selected ? "text-accent" : "text-foreground"}`}>{preset.name}</span>
                <span className="line-clamp-2 text-[11px] leading-tight text-muted">{preset.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
