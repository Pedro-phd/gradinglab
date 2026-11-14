"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

const CLOSE_DISTANCE = 96; // px arrastados para baixo que fecham o painel

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  /** À direita do título: "OK", contagem etc. */
  action?: ReactNode;
  /** Quase tela cheia (galeria); sem isso, a altura acompanha o conteúdo. */
  tall?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

// Painel que sobe de baixo, como no iOS: <dialog> nativo (prende o foco, fecha com Esc, devolve o foco),
// alça para arrastar e fechar. No computador vira uma janela centralizada.
export function Sheet({ open, onClose, title, titleId, action, tall = false, footer, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function start(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("button, a, input")) return; // o "OK" continua sendo um toque
    drag.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (drag.current === null || !dialog.current) return;
    dialog.current.style.transform = `translateY(${Math.max(0, event.clientY - drag.current)}px)`;
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current === null || !dialog.current) return;
    const distance = event.clientY - drag.current;
    drag.current = null;
    dialog.current.style.transform = "";
    if (distance > CLOSE_DISTANCE) onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()} // toque no fundo escurecido
      className={`m-0 mt-auto w-full max-w-none flex-col overflow-hidden rounded-t-[28px] bg-surface p-0 pb-[env(safe-area-inset-bottom)] text-foreground backdrop:bg-black/40 open:flex open:motion-safe:animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)] md:m-auto md:max-w-lg md:rounded-[28px] md:pb-0 ${tall ? "h-[calc(100dvh-58px)] md:h-[85dvh]" : "max-h-[calc(100dvh-58px)] md:max-h-[85dvh]"}`}
    >
      <div onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="shrink-0 cursor-grab touch-none pt-2">
        <span aria-hidden="true" className="mx-auto block h-[5px] w-9 rounded-full bg-white/30" />
        <div className="flex min-h-11 items-center justify-between gap-3 pb-1.5 pl-5 pr-2 pt-2">
          <h2 id={titleId} className="font-display text-[22px] font-bold">{title}</h2>
          {action}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer}
    </dialog>
  );
}

/** Botão de texto à direita do título, como o "OK" das folhas do iOS. */
export function SheetDone({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 items-center rounded-full px-3 text-[17px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-white">
      OK
    </button>
  );
}
