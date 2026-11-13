"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { nextSplit, splitFromPointer, type CompareMode, type CompareView } from "./compare";

const chip = "rounded-full bg-[#12110f]/60 px-3.5 py-2 text-[13px] font-medium text-foreground backdrop-blur-md";

const MODES: [CompareMode, string][] = [
  ["compare", "Antes / depois"],
  ["result", "Só o resultado"],
  ["original", "Original"],
];

export function ModeGroup({ mode, onChange }: { mode: CompareMode; onChange: (mode: CompareMode) => void }) {
  return (
    <div role="group" aria-label="Modo de comparação" className="flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-white/10 bg-white/[.08] p-1">
      {MODES.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
          className={`h-11 whitespace-nowrap rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${mode === id ? "bg-accent text-accent-ink" : "text-foreground hover:bg-white/10"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Sobre o vídeo: rótulos (que não capturam o ponteiro) e a alça do divisor. Nada aqui redesenha o quadro;
// quem aparece de cada lado é decidido pelo shader. Sem transições, então "reduzir movimento" não tem o que desligar.
export function CompareOverlay({ view, split, onSplit }: { view: CompareView; split: number; onSplit: (split: number) => void }) {
  // O pai é a caixa da imagem, com a mesma proporção do vídeo: a fração vale para a imagem toda.
  function move(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (box) onSplit(splitFromPointer(event.clientX, box.left, box.width));
  }
  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextSplit(split, event.key);
    if (next === null) return;
    event.preventDefault();
    onSplit(next);
  }
  const percent = Math.round(split * 100);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between gap-2">
        {view.leftLabel && <span className={chip}>{view.leftLabel}</span>}
        {view.rightLabel && <span className={`${chip} ml-auto truncate`}>{view.rightLabel}</span>}
      </div>
      {view.handleVisible && (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posição do divisor antes/depois"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`antes ocupa ${percent}% da imagem`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            move(event);
          }}
          onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && move(event)}
          onKeyDown={handleKey}
          style={{ left: `${split * 100}%` }}
          className="group absolute inset-y-0 w-16 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/.25)]" />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 flex h-10 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 rounded-full bg-accent text-accent-ink shadow-[0_4px_16px_rgb(0_0_0/.4)] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </span>
        </div>
      )}
    </>
  );
}
