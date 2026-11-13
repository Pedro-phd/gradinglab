"use client";

import type { ChangeEvent } from "react";
import { canAdjustIntensity, type LutState } from "./lut-state";

const panel = "rounded-[28px] border border-white/10 bg-white/[.07] backdrop-blur-xl";
const pill =
  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-semibold motion-safe:transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white";

type Props = {
  state: LutState;
  intensity: number; // percentual 0..100
  onIntensityChange: (percent: number) => void;
  onLutFile: (file: File) => void;
};

export function LookPanel({ state, intensity, onIntensityChange, onLutFile }: Props) {
  const enabled = canAdjustIntensity(state);
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (file) onLutFile(file);
  }

  return (
    <aside aria-label="Ajustes de cor" className={`${panel} order-2 flex flex-col gap-5 p-5 md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:self-start`}>
      <section aria-labelledby="look-titulo" className="flex flex-col gap-3">
        <h2 id="look-titulo" className="font-display text-[15px] font-semibold">Look</h2>
        {state.error && (
          <p key={state.error.attempt} role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
            {state.error.message}
            {state.lut && " A LUT anterior continua aplicada."}
          </p>
        )}
        <div className="flex items-center gap-3 rounded-[18px] bg-black/30 p-2.5">
          <div className="min-w-0 flex-1 pl-1.5">
            <p className="truncate text-sm font-medium">{state.name ?? "Nenhuma LUT importada"}</p>
            <p className="text-xs text-muted">{state.lut ? `LUT 3D · ${state.lut.size} pontos` : "Arquivo .cube 3D, lido neste aparelho."}</p>
          </div>
          {/* O input fica fora do fluxo visual, mas focável; o foco acende o label logo depois dele. */}
          <input id="lut-input" type="file" accept=".cube" onChange={handleFile} className="peer sr-only" />
          <label
            htmlFor="lut-input"
            className={`${pill} ${state.lut ? "border border-white/20 hover:bg-white/10" : "bg-accent text-accent-ink hover:brightness-110"}`}
          >{state.lut ? "Trocar" : "Importar LUT"}</label>
        </div>
      </section>

      <section aria-labelledby="intensidade-titulo" className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label id="intensidade-titulo" htmlFor="intensidade" className="font-display text-[15px] font-semibold">
            Intensidade
          </label>
          <output htmlFor="intensidade" className="font-display text-[32px] font-semibold tabular-nums text-accent">{intensity}%</output>
        </div>
        <input
          id="intensidade"
          type="range"
          min={0}
          max={100}
          step={1}
          value={intensity}
          disabled={!enabled}
          onChange={(event) => onIntensityChange(Number(event.target.value))}
          className="h-11 w-full cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>0% · sem look</span>
          <span>100% · look integral</span>
        </div>
        {!enabled && <p className="text-xs text-muted">Importe uma LUT para ajustar a intensidade.</p>}
      </section>
    </aside>
  );
}
