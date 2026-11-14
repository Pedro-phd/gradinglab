import { describe, expect, it } from "vitest";
import { exportFileName } from "./export-plan";
import { isPhotoFile } from "./photo";

describe("isPhotoFile", () => {
  it("aceita qualquer tipo image/", () => {
    expect(isPhotoFile({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isPhotoFile({ type: "image/heic", name: "IMG_1.HEIC" })).toBe(true);
  });
  it("sem tipo, decide pela extensão", () => {
    expect(isPhotoFile({ type: "", name: "IMG_1.HEIC" })).toBe(true);
    expect(isPhotoFile({ type: "", name: "clip.mov" })).toBe(false);
  });
  it("vídeo não é foto", () => {
    expect(isPhotoFile({ type: "video/quicktime", name: "a.jpg" })).toBe(false);
  });
});

describe("exportFileName", () => {
  it("usa a extensão da foto", () => {
    expect(exportFileName("IMG 1.HEIC", "Kodak 2383", "jpg")).toBe("IMG_1-Kodak_2383.jpg");
  });
});
