"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { PipelinePlan } from "./color-pipeline";
import { MAX_STACKED_LUTS, type LutAction, type LutState, type StackedLut } from "./lut-state";
import { Sheet } from "./sheet";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Props = {
  open: boolean;
  onClose: () => void;
  state: LutState;
  dispatch: (action: LutAction) => void;
  enabled: boolean; // intensidade ajustável (perfil confirmado e WebGL2)
  disabledReason: string | null;
  plan: PipelinePlan;
  thumbFor: (name: string) => string | undefined;
  onAdd: () => void;
};

type RowProps = { item: StackedLut; enabled: boolean; thumb: string | undefined; dispatch: (action: LutAction) => void };

function StackRow({ item, enabled, thumb, dispatch }: RowProps) {
  // Arrastar a alça troca a linha de lugar a cada altura de linha percorrida; as setas fazem o mesmo pelo teclado.
  const drag = useRef<{ y: number; height: number } | null>(null);
  function start(event: PointerEvent<HTMLButtonElement>) {
    const row = event.currentTarget.closest("li");
    if (!row) return;
    drag.current = { y: event.clientY, height: row.offsetHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const steps = (event.clientY - current.y) / current.height;
    if (Math.abs(steps) < 1) return;
    const offset = steps > 0 ? 1 : -1;
    current.y += offset * current.height;
    dispatch({ type: "moved", id: item.id, offset });
  }
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!offset) return;
    event.preventDefault();
    dispatch({ type: "moved", id: item.id, offset });
  }
  const sliderId = `intensidade-${item.id}`;

  return (
    <li className="flex flex-col gap-1.5 border-b border-white/10 py-3 pl-3.5 pr-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-[9px] bg-surface">
          {thumb && (
            // Miniatura gerada no aparelho (data URL): next/image não se aplica.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold" title={item.name}>{item.name}</p>
          <p className="text-xs text-muted">LUT 3D · {item.lut.size} pontos</p>
        </div>
        <button type="button" aria-label={`Remover ${item.name}`} onClick={() => dispatch({ type: "removed", id: item.id })} className={`flex size-11 shrink-0 items-center justify-center rounded-full text-muted ${focus}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <button
          type="button"
          aria-label={`Reordenar ${item.name}: arraste ou use as setas`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={key}
          className={`flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#8a857b] ${focus}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 9h14M5 15h14" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-2.5 pr-2">
        <label htmlFor={sliderId} className="sr-only">Intensidade de {item.name}</label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          value={item.intensity}
          disabled={!enabled}
          onChange={(event) => dispatch({ type: "intensity", id: item.id, percent: Number(event.target.value) })}
          className={`h-9 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40 ${focus}`}
        />
        <output htmlFor={sliderId} className="w-10 text-right text-[13px] font-semibold tabular-nums text-accent">{item.intensity}%</output>
      </div>
    </li>
  );
}

export function StackSheet({ open, onClose, state, dispatch, enabled, disabledReason, plan, thumbFor, onAdd }: Props) {
  const { stack } = state;
  return (
    <Sheet open={open} onClose={onClose} title="Pilha" titleId="pilha-titulo" action={<span className="pr-3 text-[13px] text-muted">{stack.length} de {MAX_STACKED_LUTS}</span>}>
      <div className="flex flex-col gap-3.5 px-4 pb-6">
        <p className="px-1 text-[13px] leading-[18px] text-muted">A primeira recebe o vídeo; cada uma recebe o resultado da anterior. Arraste para reordenar.</p>
        {state.error && <p key={state.error.attempt} role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{state.error.message}</p>}
        {stack.length > 0 && (
          <ol aria-label="Pilha de LUTs" className="overflow-hidden rounded-2xl bg-surface-2">
            {stack.map((item) => (
              <StackRow key={item.id} item={item} enabled={enabled} thumb={thumbFor(item.name)} dispatch={dispatch} />
            ))}
          </ol>
        )}
        {disabledReason && stack.length > 0 && <p className="px-1 text-xs text-muted">{disabledReason}</p>}
        <button
          type="button"
          disabled={stack.length >= MAX_STACKED_LUTS}
          onClick={onAdd}
          className={`flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-surface-2 text-[15px] font-semibold text-accent disabled:opacity-40 ${focus}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Adicionar LUT
        </button>
        {plan.warning && <p role="status" className="rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">{plan.warning.message}</p>}
      </div>
    </Sheet>
  );
}
