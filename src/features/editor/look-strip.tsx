"use client";

import { useState, type ReactNode } from "react";
import type { LibraryFolder } from "./lut-library";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export type Tool = "looks" | "pilha" | "origem" | "comparar";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "looks", label: "Looks", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18M3 12h18" },
  { id: "pilha", label: "Pilha", icon: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" },
  { id: "origem", label: "Origem", icon: "M4 6h16M4 12h10M4 18h6" },
  { id: "comparar", label: "Comparar", icon: "M12 3v18M5 5h14v14H5z" },
];

type Props = {
  folders: LibraryFolder[];
  thumbs: Record<string, string>;
  /** A última LUT da pilha: é o look que a fileira troca e cuja força o controle ajusta. */
  active: { name: string; intensity: number } | null;
  enabled: boolean; // perfil confirmado e WebGL2
  notice: ReactNode;
  onPick: (id: string) => void;
  onIntensity: (percent: number) => void;
};

// Faixa de looks do editor, como a de filtros do app Fotos: força do look atual, categorias e miniaturas.
export function LookStrip({ folders, thumbs, active, enabled, notice, onPick, onIntensity }: Props) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const owner = folders.find((folder) => folder.items.some((item) => item.fullName === active?.name));
  const shown = folders.find((folder) => folder.id === folderId) ?? owner ?? folders[0];
  // Nome curto da biblioteca ("Giz"), não o completo ("Academia Giz"): cabe ao lado do controle.
  const shortName = owner?.items.find((item) => item.fullName === active?.name)?.name ?? active?.name;

  return (
    <section aria-label="Looks" className="flex flex-col gap-3.5 pt-4">
      {notice}
      <div className="flex min-h-11 items-center gap-3 px-5">
        {active ? (
          <>
            <span className="w-28 shrink-0 truncate text-[15px] font-semibold" title={active.name}>{shortName}</span>
            <input
              type="range"
              aria-label={`Intensidade de ${active.name}`}
              min={0}
              max={100}
              value={active.intensity}
              disabled={!enabled}
              onChange={(event) => onIntensity(Number(event.target.value))}
              className={`h-11 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40 ${focus}`}
            />
            <output className="w-10 text-right text-[15px] font-semibold tabular-nums text-accent">{active.intensity}%</output>
          </>
        ) : (
          <p className="text-[15px] text-muted">Escolha um look abaixo.</p>
        )}
      </div>

      <div role="group" aria-label="Categorias" className="no-scrollbar flex gap-2 overflow-x-auto px-5">
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            aria-pressed={folder.id === shown?.id}
            onClick={() => setFolderId(folder.id)}
            className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${folder.id === shown?.id ? "bg-foreground text-accent-ink" : "bg-surface text-foreground"} ${focus}`}
          >
            {folder.name}
          </button>
        ))}
      </div>

      <ul aria-label={shown ? `Looks de ${shown.name}` : "Looks"} className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">
        {shown?.items.map((item) => {
          const selected = item.fullName === active?.name;
          const src = thumbs[item.id];
          return (
            <li key={item.id} className="snap-start">
              <button type="button" aria-pressed={selected} disabled={!item.lut || !enabled} onClick={() => onPick(item.id)} className={`flex w-16 flex-col items-center gap-1.5 rounded-[14px] disabled:opacity-40 ${focus}`}>
                <span className={`relative block size-16 overflow-hidden rounded-[14px] bg-surface-2 ${selected ? "ring-2 ring-accent" : "ring-1 ring-white/10"}`}>
                  {src ? (
                    // Miniatura gerada no aparelho (data URL): next/image não se aplica.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold text-muted">{item.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className={`w-full truncate text-center text-[11px] ${selected ? "text-accent" : "text-muted"}`}>{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Barra de ferramentas embaixo, como a de um app nativo: "Looks" é a faixa acima; as outras abrem painéis.
export function ToolBar({ current, onSelect }: { current: Tool; onSelect: (tool: Tool) => void }) {
  return (
    <nav aria-label="Ferramentas" className="mt-3 grid shrink-0 grid-cols-4 border-t border-white/10 px-2 pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5">
      {TOOLS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? "true" : undefined}
          onClick={() => onSelect(id)}
          className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl ${current === id ? "text-accent" : "text-muted"} ${focus}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
          <span className="text-[11px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
