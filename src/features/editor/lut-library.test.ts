import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_FOLDERS, bundledLibrary, displayName, findItem, groupByFolder, shortNames, uniqueFolderName } from "./lut-library";

const file = (name: string, webkitRelativePath = "") => ({ name, webkitRelativePath });

describe("biblioteca de LUTs da galeria", () => {
  it("agrupa por pasta de origem, ignorando metadado do macOS e arquivos que não são .cube", () => {
    const groups = groupByFolder(
      [
        file("Food LUT 02.cube", "Downloads/Food/Food LUT 02.cube"),
        file("._Food LUT 01.cube", "Downloads/Food/._Food LUT 01.cube"),
        file("Food LUT 01.cube", "Downloads/Food/Food LUT 01.cube"),
        file("leia-me.txt", "Downloads/Food/leia-me.txt"),
        file("Amber.CUBE", "Downloads/slay/Amber.CUBE"),
      ],
      "Importadas",
    );
    expect(groups.map((group) => [group.name, group.files.map((f) => f.name)])).toEqual([
      ["Food", ["Food LUT 01.cube", "Food LUT 02.cube"]],
      ["slay", ["Amber.CUBE"]],
    ]);
  });

  it("arquivos soltos, sem caminho de pasta, vão para a pasta padrão", () => {
    expect(groupByFolder([file("a.cube"), file("b.cube")], "Importadas")).toEqual([{ name: "Importadas", files: [file("a.cube"), file("b.cube")] }]);
  });

  it("não repete o nome de uma pasta que já existe", () => {
    expect(uniqueFolderName("Food", ["slay"])).toBe("Food");
    expect(uniqueFolderName("Food", ["Food", "Food (2)"])).toBe("Food (3)");
  });

  it("encurta nomes de uma pasta tirando o prefixo comum, sem deixar nome vazio", () => {
    expect(shortNames(["Videofullness FREE Food LUT 01", "Videofullness FREE Food LUT 02"])).toEqual(["LUT 01", "LUT 02"]);
    expect(shortNames(["Amber", "Fade"])).toEqual(["Amber", "Fade"]);
    expect(shortNames(["Look", "Look"])).toEqual(["Look", "Look"]);
    expect(shortNames(["Apple Log to Rec709"])).toEqual(["Apple Log to Rec709"]);
  });

  it("mostra o nome sem a extensão", () => {
    expect(displayName("Apple Log to Rec709.cube")).toBe("Apple Log to Rec709");
  });

  it("as pastas embutidas começam sem LUT carregada e cada item é encontrado pelo id", () => {
    const library = bundledLibrary();
    expect(library.flatMap((folder) => folder.items).every((item) => item.lut === null && item.error === null)).toBe(true);
    expect(findItem(library, "slay-film")?.name).toBe("Film");
    expect(findItem(library, "nao-existe")).toBeNull();
    expect(library.slice(0, 4).map((folder) => [folder.name, folder.items.length])).toEqual([["Cinemático", 4], ["Social", 2], ["Limpo", 1], ["Filme", 1]]);
    expect(findItem(library, "gl-ouro")?.fullName).toBe("Social Ouro");
    expect(findItem(library, "gl-breu")?.fullName).toBe("Academia Breu");
  });

  it("todo arquivo embutido existe em public/ e toda pasta embutida traz crédito", () => {
    for (const folder of BUNDLED_FOLDERS) {
      expect(folder.credit).not.toBeNull();
      for (const item of folder.items) expect(existsSync(join(process.cwd(), "public", item.url))).toBe(true);
    }
  });
});
