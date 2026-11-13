"use client";

import type { ReactNode } from "react";
import type { PipelinePlan, ProfileChoice, SourceProfile } from "./color-pipeline";
import { MAX_STACKED_LUTS, type LutAction, type LutState, type StackedLut } from "./lut-state";
import { SourceProfileSection } from "./source-profile";

const panel = "rounded-[28px] border border-white/10 bg-white/[.07] backdrop-blur-xl";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const iconButton = `inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 ${focus}`;

type Props = {
  state: LutState;
  dispatch: (action: LutAction) => void;
  unsupported: boolean; // sem WebGL2 não há como aplicar o look
  choice: ProfileChoice;
  plan: PipelinePlan;
  hdr: boolean;
  onProfileChange: (profile: SourceProfile) => void;
  onOpenGallery: () => void; // abre a galeria, de onde as LUTs entram na pilha
  exportSection: ReactNode;
};

type LayerProps = { item: StackedLut; index: number; count: number; enabled: boolean; dispatch: (action: LutAction) => void };

function LutLayerRow({ item, index, count, enabled, dispatch }: LayerProps) {
  const sliderId = `intensidade-${item.id}`;
  return (
    <li className="flex flex-col gap-1 rounded-[18px] bg-black/30 p-2.5">
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.name}>{item.name}</p>
          <p className="text-xs text-muted">LUT 3D · {item.lut.size} pontos</p>
        </div>
        <button type="button" aria-label={`Subir ${item.name}`} disabled={index === 0} onClick={() => dispatch({ type: "moved", id: item.id, offset: -1 })} className={iconButton}>↑</button>
        <button type="button" aria-label={`Descer ${item.name}`} disabled={index === count - 1} onClick={() => dispatch({ type: "moved", id: item.id, offset: 1 })} className={iconButton}>↓</button>
        <button type="button" aria-label={`Remover ${item.name}`} onClick={() => dispatch({ type: "removed", id: item.id })} className={iconButton}>✕</button>
      </div>
      <div className="flex items-center gap-3 pl-7">
        <label htmlFor={sliderId} className="sr-only">Intensidade de {item.name}</label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={item.intensity}
          disabled={!enabled}
          onChange={(event) => dispatch({ type: "intensity", id: item.id, percent: Number(event.target.value) })}
          className={`h-11 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40 ${focus}`}
        />
        <output htmlFor={sliderId} className="w-12 text-right font-display text-base font-semibold tabular-nums text-accent">{item.intensity}%</output>
      </div>
    </li>
  );
}

export function LookPanel({ state, dispatch, unsupported, choice, plan, hdr, onProfileChange, onOpenGallery, exportSection }: Props) {
  const { stack } = state;
  const enabled = !unsupported && plan.intensityAvailable;

  return (
    <aside aria-label="Ajustes de cor" className={`${panel} order-2 flex flex-col gap-5 p-5 md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:self-start`}>
      <SourceProfileSection choice={choice} plan={plan} lutExpectsLog={state.firstExpectsLog} hdr={hdr} disabled={unsupported} onChoose={onProfileChange} />

      <section aria-labelledby="look-titulo" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="look-titulo" className="font-display text-[15px] font-semibold">LUTs</h2>
          <span className="text-xs text-muted">{stack.length > 1 ? "aplicadas de cima para baixo" : `até ${MAX_STACKED_LUTS}`}</span>
        </div>
        {state.error && (
          <p key={state.error.attempt} role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{state.error.message}</p>
        )}
        {stack.length > 0 && (
          <ol aria-label="Pilha de LUTs" className="flex flex-col gap-2">
            {stack.map((item, index) => (
              <LutLayerRow key={item.id} item={item} index={index} count={stack.length} enabled={enabled} dispatch={dispatch} />
            ))}
          </ol>
        )}
        {!enabled && stack.length > 0 && <p className="text-xs text-muted">{unsupported ? "Indisponível sem WebGL2." : "Confirme a origem do vídeo para ajustar as intensidades."}</p>}
        <button
          type="button"
          disabled={unsupported || stack.length >= MAX_STACKED_LUTS}
          onClick={onOpenGallery}
          className={`h-11 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${focus} ${stack.length > 0 ? "border border-white/20 hover:bg-white/10" : "bg-accent text-accent-ink hover:brightness-110"}`}
        >Adicionar LUT</button>
        {plan.warning && <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">{plan.warning.message}</p>}
      </section>

      {exportSection}
    </aside>
  );
}
