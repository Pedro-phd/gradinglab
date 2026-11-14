"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { nextSplit, splitFromPointer, type CompareView } from "./compare";

const chip = "rounded-[10px] bg-black/55 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur-md";

function Chip({ full, short, className = "" }: { full: string; short: string | null; className?: string }) {
  return (
    <span className={`${chip} ${className}`}>
      <span className="md:hidden">{short ?? full}</span>
      <span className="hidden md:inline">{full}</span>
    </span>
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
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-2">
        {view.leftLabel && <Chip full={view.leftLabel} short={view.leftShort} />}
        {view.rightLabel && <Chip full={view.rightLabel} short={view.rightShort} className="ml-auto truncate" />}
      </div>
      {view.handleVisible && (
        <>
          {/* A linha fica no ponto exato; só a alça é afastada das bordas, para o recorte do container não cortá-la. */}
          <span aria-hidden="true" style={{ left: `${split * 100}%` }} className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_rgb(0_0_0/.25)]" />
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
            // 72 px = alça de 44 px com folga para o toque e o anel de foco; nas bordas a caixa para dentro do recorte.
            style={{ left: `clamp(36px, ${split * 100}%, calc(100% - 36px))` }}
            className="group absolute inset-y-0 w-[72px] -translate-x-1/2 cursor-ew-resize touch-none outline-none"
          >
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-accent-ink shadow-[0_4px_16px_rgb(0_0_0/.4)] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-white"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
            </span>
          </div>
        </>
      )}
    </>
  );
}
