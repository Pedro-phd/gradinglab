"use client";

import { useState, type ChangeEvent } from "react";
import type { LibraryFolder, LibraryItem } from "./lut-library";
import { Sheet, SheetDone } from "./sheet";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const importButton = "flex h-12 flex-1 cursor-pointer items-center justify-center rounded-[14px] bg-surface-2 text-[15px] font-semibold";
const IMPORT_FALLBACK = "Importadas";

type Props = {
  open: boolean;
  onClose: () => void;
  folders: LibraryFolder[];
  thumbs: Record<string, string>;
  /** Por que as miniaturas não estão sendo geradas agora; null quando estão. */
  thumbStatus: string | null;
  disabled: boolean; // sem WebGL2
  /** Nomes das LUTs que já estão na pilha: aparecem marcadas. */
  stacked: string[];
  error: { message: string; attempt: number } | null;
  onToggle: (id: string) => void; // toque adiciona; tocar de novo tira da pilha
  onImport: (files: File[], fallbackName: string) => void;
  onRemoveFolder: (id: string) => void;
};

function Thumb({ item, src, added, onToggle }: { item: LibraryItem; src: string | undefined; added: boolean; onToggle: () => void }) {
  const ready = item.lut !== null;
  return (
    <li className="min-w-0">
      <button type="button" aria-pressed={added} aria-label={`${added ? "Tirar da pilha" : "Adicionar"}: ${item.fullName}`} disabled={!ready} onClick={onToggle} className={`flex w-full flex-col gap-1.5 rounded-xl disabled:cursor-not-allowed ${focus}`}>
        <span className={`relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-black ${added ? "ring-2 ring-accent" : "ring-[0.5px] ring-white/15"}`}>
          {src && ready ? (
            // Miniatura gerada no aparelho (data URL): next/image não se aplica.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted">{item.error ?? (ready ? "Sem miniatura" : "Carregando…")}</span>
          )}
          {added && (
            <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex size-[22px] items-center justify-center rounded-full bg-accent text-accent-ink">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </span>
          )}
        </span>
        <span className="block truncate text-center text-xs font-medium" title={item.fullName}>{item.name}</span>
      </button>
    </li>
  );
}

// Folha quase em tela cheia: busca, categorias e as miniaturas no quadro pausado do vídeo.
export function LutGallery({ open, onClose, folders, thumbs, thumbStatus, disabled, stacked, error, onToggle, onImport, onRemoveFolder }: Props) {
  const [tab, setTab] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const current = folders.find((folder) => folder.id === tab) ?? folders[0];
  const term = query.trim().toLocaleLowerCase("pt-BR");
  // Com busca, procura em todas as categorias; sem busca, mostra só a escolhida.
  const items = term
    ? folders.flatMap((folder) => folder.items.filter((item) => `${item.fullName} ${item.hint ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)))
    : (current?.items ?? []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite importar a mesma pasta de novo
    if (files.length > 0) onImport(files, IMPORT_FALLBACK);
  }

  const footer = (
    <div className="flex shrink-0 gap-2.5 border-t border-white/10 bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 md:pb-4">
      <input id="galeria-arquivos" type="file" accept=".cube" multiple disabled={disabled} onChange={handleFiles} className="peer/arquivos sr-only" />
      <label htmlFor="galeria-arquivos" className={`${importButton} peer-focus-visible/arquivos:outline-2 peer-focus-visible/arquivos:outline-white`}>Importar .cube</label>
      {/* Pasta inteira (Chrome, Edge, Firefox no computador): cada subpasta vira uma categoria. */}
      <input id="galeria-pasta" type="file" multiple disabled={disabled} onChange={handleFiles} className="peer/pasta sr-only" {...{ webkitdirectory: "" }} />
      <label htmlFor="galeria-pasta" className={`${importButton} peer-focus-visible/pasta:outline-2 peer-focus-visible/pasta:outline-white`}>Importar pasta</label>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar LUT" titleId="galeria-titulo" tall action={<SheetDone onClick={onClose} />} footer={footer}>
      <div className="flex flex-col gap-3 pb-4">
        <div className="px-4 pt-1">
          <label className="flex h-[38px] items-center gap-2 rounded-[11px] bg-surface-2 px-2.5 text-muted focus-within:outline-2 focus-within:outline-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <span className="sr-only">Buscar LUT</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted" />
          </label>
        </div>

        {!term && (
          <div role="group" aria-label="Categorias" className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {folders.map((folder) => (
              <button key={folder.id} type="button" aria-pressed={folder.id === current?.id} onClick={() => setTab(folder.id)} className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${folder.id === current?.id ? "bg-foreground text-accent-ink" : "bg-surface-2 text-foreground"} ${focus}`}>
                {folder.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-11 items-center justify-between gap-2 px-5">
          <p role="status" className="text-[13px] text-muted">{thumbStatus ?? "Prévia no quadro atual do seu vídeo. Toque para adicionar à pilha."}</p>
          {!term && current?.credit === null && (
            <button type="button" onClick={() => onRemoveFolder(current.id)} className={`h-11 shrink-0 rounded-full px-2 text-xs text-muted ${focus}`}>Remover pasta</button>
          )}
        </div>
        {error && <p key={error.attempt} role="alert" className="mx-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error.message}</p>}

        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-muted">{term ? "Nenhuma LUT com esse nome." : "Esta categoria está vazia."}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2.5 px-4 sm:grid-cols-4">
            {items.map((item) => (
              <Thumb key={item.id} item={item} src={thumbs[item.id]} added={stacked.includes(item.fullName)} onToggle={() => onToggle(item.id)} />
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
