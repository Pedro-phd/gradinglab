"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CUBE_LUT_FILE_BYTES, parseCubeLut, readCubeLutFile } from "./cube-lut";
import { BUNDLED_FOLDERS, bundledLibrary, displayName, groupByFolder, shortNames, uniqueFolderName, type LibraryFolder, type LibraryItem } from "./lut-library";

const LOAD_FAILED = "Não foi possível carregar esta LUT.";

// LUT embutida: arquivo do próprio app; passa pelo mesmo parser (e o mesmo limite) das LUTs importadas.
export async function fetchBundled(url: string): Promise<Pick<LibraryItem, "lut" | "error">> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { lut: null, error: LOAD_FAILED };
    const text = await response.text();
    if (text.length > MAX_CUBE_LUT_FILE_BYTES) return { lut: null, error: LOAD_FAILED };
    const result = parseCubeLut(text);
    return result.ok ? { lut: result.lut, error: null } : { lut: null, error: result.error.message };
  } catch {
    return { lut: null, error: LOAD_FAILED };
  }
}

/** Pastas da galeria. As importadas vivem só nesta aba: nada é salvo nem enviado. */
export function useLutLibrary() {
  const [folders, setFolders] = useState<LibraryFolder[]>(bundledLibrary);
  const nextId = useRef(1);

  function patchItem(id: string, patch: Partial<LibraryItem>) {
    setFolders((current) => current.map((folder) => ({ ...folder, items: folder.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) })));
  }

  useEffect(() => {
    let active = true;
    for (const item of BUNDLED_FOLDERS.flatMap((folder) => folder.items)) {
      void fetchBundled(item.url).then((loaded) => active && patchItem(item.id, loaded));
    }
    return () => {
      active = false;
    };
  }, []);

  /** Cada pasta de origem vira uma pasta da galeria; devolve quantas LUTs entraram. */
  async function importFiles(files: File[], fallbackName: string): Promise<number> {
    const groups = groupByFolder(files, fallbackName);
    const created: LibraryFolder[] = [];
    let taken = folders.map((folder) => folder.name);
    for (const group of groups) {
      const name = uniqueFolderName(group.name, taken);
      taken = [...taken, name];
      const short = shortNames(group.files.map((file) => displayName(file.name)));
      const items = await Promise.all(
        group.files.map(async (file, index): Promise<LibraryItem> => {
          const result = await readCubeLutFile(file);
          return { id: `importada-${nextId.current++}`, name: short[index]!, fullName: displayName(file.name), hint: null, lut: result.ok ? result.lut : null, error: result.ok ? null : result.error.message };
        }),
      );
      created.push({ id: `pasta-${nextId.current++}`, name, source: "importada deste aparelho", credit: null, items });
    }
    // Importadas primeiro: é o que o usuário acabou de escolher.
    setFolders((current) => [...created, ...current]);
    return created.reduce((count, folder) => count + folder.items.filter((item) => item.lut).length, 0);
  }

  function removeFolder(id: string) {
    setFolders((current) => current.filter((folder) => folder.id !== id));
  }

  return { folders, importFiles, removeFolder };
}
