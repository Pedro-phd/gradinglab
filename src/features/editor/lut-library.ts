// Biblioteca de LUTs da galeria: pastas embutidas no app e pastas importadas pelo usuário.
// Lógica pura: nada aqui lê arquivo nem acessa a rede.
import type { CubeLut } from "./cube-lut";

export type LibraryItem = {
  id: string;
  name: string; // curto, para a miniatura
  fullName: string; // vai para a pilha e para a dica do nome
  hint: string | null;
  /** null enquanto carrega; a falha fica em `error`. */
  lut: CubeLut | null;
  error: string | null;
};

export type LibraryFolder = {
  id: string;
  name: string;
  /** Origem mostrada no cabeçalho da pasta (licença ou "importada"). */
  source: string;
  credit: { label: string; href: string } | null;
  items: LibraryItem[];
};

export type BundledFolder = Omit<LibraryFolder, "items"> & {
  items: { id: string; name: string; hint: string; url: string }[];
};

// Arquivos em public/luts/, servidos pelo próprio app (mesma origem). Licença e origem: public/luts/<pasta>/CREDITS.md.
// Looks próprios do projeto (public/luts/gradinglab), separados por categoria. Esperam imagem em Rec.709.
const OWN = { source: "feitas para o GradingLab · entrada Rec.709", credit: { label: "GradingLab", href: "https://github.com/Pedro-phd/gradinglab" } };
const own = (id: string, name: string, hint: string) => ({ id: `gl-${id}`, name, hint, url: `/luts/gradinglab/${id}.cube` });

export const BUNDLED_FOLDERS: BundledFolder[] = [
  {
    id: "gl-cinematico",
    name: "Cinemático",
    ...OWN,
    items: [
      own("cine-ambar", "Cine Âmbar", "escuro, luzes âmbar"),
      own("teal-laranja", "Teal & Laranja", "sombras frias, doces quentes"),
      own("print-2383", "Print 2383", "cópia de cinema"),
      own("luz-de-vela", "Luz de Vela", "bem escuro e laranja"),
    ],
  },
  { id: "gl-social", name: "Social", ...OWN, items: [own("ouro", "Ouro", "laranjas fortes, neutros frios"), own("pop-doce", "Pop Doce", "saturado e limpo")] },
  { id: "gl-limpo", name: "Limpo", ...OWN, items: [own("creme", "Creme", "quente e macio")] },
  { id: "gl-filme", name: "Filme", ...OWN, items: [own("cromo", "Cromo", "slide denso anos 70")] },
  {
    id: "gl-academia",
    name: "Academia",
    ...OWN,
    items: [
      own("dark-mode", "Dark Mode", "escuro e seco"),
      own("breu", "Breu", "o mais escuro"),
      own("giz", "Giz", "quase sem cor, pele quente"),
      own("creme-sombrio", "Creme Sombrio", "luzes creme, pretos foscos"),
      own("chumbo", "Chumbo", "cinza neutro e denso"),
    ],
  },
  {
    id: "slay",
    name: "slay",
    source: "CC BY 4.0",
    credit: { label: "slay — slaycamera.com", href: "https://www.slaycamera.com" },
    items: [
      { id: "slay-amber", name: "Amber", hint: "golden hour", url: "/luts/slay/slay-01-amber.cube" },
      { id: "slay-fade", name: "Fade", hint: "filme fosco", url: "/luts/slay/slay-02-fade.cube" },
      { id: "slay-neon", name: "Neon", hint: "noite, contraste", url: "/luts/slay/slay-03-neon.cube" },
      { id: "slay-film", name: "Film", hint: "fílmico clássico", url: "/luts/slay/slay-04-film.cube" },
      { id: "slay-portrait", name: "Portrait", hint: "pele suave", url: "/luts/slay/slay-05-portrait.cube" },
    ],
  },
];

export function bundledLibrary(): LibraryFolder[] {
  return BUNDLED_FOLDERS.map(({ items, ...folder }) => ({
    ...folder,
    items: items.map(({ id, name, hint }) => ({ id, name, fullName: `${folder.name} ${name}`, hint, lut: null, error: null })),
  }));
}

/** Nome exibido: sem a extensão .cube. */
export function displayName(fileName: string): string {
  return fileName.replace(/\.cube$/i, "");
}

/**
 * Nomes curtos para uma pasta: tira as palavras iniciais comuns a todos, menos a última delas
 * ("Videofullness FREE Food LUT 01…05" → "LUT 01…05"). Com um nome só, nada muda.
 */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  const words = names.map((name) => name.split(/\s+/));
  let common = 0;
  while (words.every((w) => common < w.length - 1 && w[common] === words[0]![common])) common += 1;
  const cut = Math.max(0, common - 1);
  return words.map((w) => w.slice(cut).join(" "));
}

// "._arquivo" é metadado do macOS que vem junto em zip e pendrive, não uma LUT.
function isCandidate(name: string): boolean {
  return name.toLowerCase().endsWith(".cube") && !name.startsWith("._");
}

type PickedFile = { name: string; webkitRelativePath?: string };

/**
 * Agrupa os arquivos escolhidos por pasta de origem (a pasta logo acima do arquivo, quando o
 * navegador informa o caminho). Sem caminho (seleção de arquivos soltos), tudo vai para `fallbackName`.
 */
export function groupByFolder<T extends PickedFile>(files: T[], fallbackName: string): { name: string; files: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const file of files) {
    if (!isCandidate(file.name)) continue;
    const parts = (file.webkitRelativePath ?? "").split("/").filter(Boolean);
    const name = parts.length >= 2 ? parts[parts.length - 2]! : fallbackName;
    groups.set(name, [...(groups.get(name) ?? []), file]);
  }
  return [...groups].map(([name, grouped]) => ({ name, files: grouped.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })) }));
}

/** Nome livre para uma pasta nova: "Food", "Food (2)"… */
export function uniqueFolderName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

export function findItem(folders: LibraryFolder[], id: string): LibraryItem | null {
  for (const folder of folders) {
    const item = folder.items.find((candidate) => candidate.id === id);
    if (item) return item;
  }
  return null;
}
