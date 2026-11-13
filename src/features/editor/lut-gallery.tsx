"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { LibraryFolder, LibraryItem } from "./lut-library";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const ghost = "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-white/20 px-4 text-sm font-semibold hover:bg-white/10";
const IMPORT_FALLBACK = "Importadas";

type Props = {
  open: boolean;
  onClose: () => void;
  folders: LibraryFolder[];
  thumbs: Record<string, string>;
  /** Por que as miniaturas não estão sendo geradas agora; null quando estão. */
  thumbStatus: string | null;
  disabled: boolean; // sem WebGL2
  onAdd: (id: string) => void; // escolher uma LUT já a põe na pilha
  onImport: (files: File[], fallbackName: string) => void;
  onRemoveFolder: (id: string) => void;
};

function Thumb({ item, src, onAdd }: { item: LibraryItem; src: string | undefined; onAdd: () => void }) {
  const ready = item.lut !== null;
  return (
    <li className="min-w-0">
      <button type="button" aria-label={`Adicionar ${item.name}`} disabled={!ready} onClick={onAdd} className={`group/thumb flex w-full flex-col gap-1.5 rounded-2xl text-left disabled:cursor-not-allowed ${focus}`}>
        <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border-2 border-transparent bg-black group-hover/thumb:border-accent">
          {src && ready ? (
            // Miniatura gerada no aparelho (data URL): next/image não se aplica.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted">{item.error ?? (ready ? "Sem miniatura" : "Carregando…")}</span>
          )}
        </span>
        <span className="block min-w-0">
          <span className="block truncate text-[13px] font-semibold" title={item.fullName}>{item.name}</span>
          {item.hint && <span className="block truncate text-[11px] text-muted">{item.hint}</span>}
        </span>
      </button>
    </li>
  );
}

// <dialog> nativo: prende o foco, fecha com Esc e devolve o foco ao botão que abriu.
// No celular é uma gaveta presa embaixo; no computador, uma janela centralizada.
export function LutGallery({ open, onClose, folders, thumbs, thumbStatus, disabled, onAdd, onImport, onRemoveFolder }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<string>("all");
  const activeTab = tab === "all" || folders.some((folder) => folder.id === tab) ? tab : "all";
  const shown = folders.filter((folder) => activeTab === "all" || folder.id === activeTab);
  const tabs = [{ id: "all", label: "Todas" }, ...folders.map((folder) => ({ id: folder.id, label: folder.name }))];

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite importar a mesma pasta de novo
    if (files.length > 0) onImport(files, IMPORT_FALLBACK);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="galeria-titulo"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()} // clique no fundo escuro
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] border border-white/10 bg-background p-0 text-foreground backdrop:bg-black/70 open:motion-safe:animate-[sheet-up_.22s_ease-out] md:m-auto md:max-h-[85dvh] md:max-w-3xl md:rounded-[28px]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="galeria-titulo" className="font-display text-lg font-semibold">Adicionar LUT</h2>
            <p role="status" className="text-xs text-muted">{thumbStatus ?? "Toque em uma LUT para adicionar à pilha."}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 ${focus}`}>✕</button>
        </div>

        <div role="group" aria-label="Categorias" className="flex flex-wrap gap-1.5">
          {tabs.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setTab(id)} className={`inline-flex h-10 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold ${activeTab === id ? "border-accent bg-accent text-accent-ink" : "border-white/15 hover:bg-white/10"} ${focus}`}>
              {label}
            </button>
          ))}
        </div>

        {shown.map((folder) => (
          <section key={folder.id} aria-label={folder.name} className="flex flex-col gap-2.5">
            <div className="flex min-h-11 items-center justify-between gap-2">
              <h3 className="truncate font-display text-[15px] font-semibold">{folder.name}</h3>
              {folder.credit === null ? (
                <button type="button" onClick={() => onRemoveFolder(folder.id)} className={`h-11 shrink-0 rounded-full px-3 text-xs text-muted hover:bg-white/10 hover:text-foreground ${focus}`}>Remover pasta</button>
              ) : (
                <a href={folder.credit.href} target="_blank" rel="noreferrer" className={`shrink-0 text-[11px] text-muted underline ${focus}`}>por {folder.credit.label}</a>
              )}
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {folder.items.map((item) => (
                <Thumb key={item.id} item={item} src={thumbs[item.id]} onAdd={() => onAdd(item.id)} />
              ))}
            </ul>
          </section>
        ))}

        <div className="flex flex-wrap gap-2.5 border-t border-white/10 pt-4">
          {/* Pasta inteira (Chrome, Edge, Firefox no computador): cada subpasta vira uma categoria. */}
          <input id="galeria-pasta" type="file" multiple disabled={disabled} onChange={handleFiles} className="peer/pasta sr-only" {...{ webkitdirectory: "" }} />
          <label htmlFor="galeria-pasta" className={`${ghost} peer-focus-visible/pasta:outline-2 peer-focus-visible/pasta:outline-offset-2 peer-focus-visible/pasta:outline-white`}>Importar pasta</label>
          <input id="galeria-arquivos" type="file" accept=".cube" multiple disabled={disabled} onChange={handleFiles} className="peer/arquivos sr-only" />
          <label htmlFor="galeria-arquivos" className={`${ghost} peer-focus-visible/arquivos:outline-2 peer-focus-visible/arquivos:outline-offset-2 peer-focus-visible/arquivos:outline-white`}>Importar .cube</label>
        </div>
      </div>
    </dialog>
  );
}
