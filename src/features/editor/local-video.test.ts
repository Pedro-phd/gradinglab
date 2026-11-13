import { describe, expect, it } from "vitest";
import {
  describeDimensions,
  describeVideoError,
  formatDuration,
  validateVideoFile,
} from "./local-video";

function fileOf(type: string, content = "x") {
  return new File([content], "clip", { type });
}

describe("validação do arquivo de vídeo", () => {
  it("aceita arquivo com tipo de vídeo", () => {
    expect(validateVideoFile(fileOf("video/quicktime")).ok).toBe(true);
    expect(validateVideoFile(fileOf("video/mp4")).ok).toBe(true);
  });

  it("rejeita arquivo que não é vídeo", () => {
    const result = validateVideoFile(fileOf("image/png"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_video");
  });

  it("tenta abrir arquivo sem tipo informado e deixa o navegador decidir", () => {
    expect(validateVideoFile(fileOf("")).ok).toBe(true);
  });

  it("rejeita arquivo vazio", () => {
    const result = validateVideoFile(fileOf("video/mp4", ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("empty_file");
  });

  it("não rejeita por duração ou tamanho: não existe teto fixo", () => {
    const file = fileOf("video/mp4");
    Object.defineProperty(file, "size", { value: 20 * 1024 ** 3 });
    expect(validateVideoFile(file).ok).toBe(true);
  });
});

describe("descrição da mídia", () => {
  it("formata duração como m:ss e h:mm:ss", () => {
    expect(formatDuration(42)).toBe("0:42");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("descreve dimensões e orientação", () => {
    expect(describeDimensions(3840, 2160)).toBe("3840 × 2160 · horizontal");
    expect(describeDimensions(1080, 1920)).toBe("1080 × 1920 · vertical");
    expect(describeDimensions(1080, 1080)).toBe("1080 × 1080 · quadrado");
  });

  it("mostra 'desconhecido' quando o navegador não informa um dado", () => {
    expect(formatDuration(Number.NaN)).toBe("duração desconhecida");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("duração desconhecida");
    expect(describeDimensions(0, 0)).toBe("dimensões desconhecidas");
    for (const text of [formatDuration(Number.NaN), describeDimensions(0, 0)]) {
      expect(text).not.toContain("NaN");
    }
  });
});

describe("erro de reprodução", () => {
  it("traduz o erro do elemento de vídeo em mensagem pt-BR com o motivo", () => {
    const message = describeVideoError(4); // MEDIA_ERR_SRC_NOT_SUPPORTED
    expect(message).toMatch(/este navegador não consegue abrir o formato/i);
    expect(message).not.toMatch(/stack|at \w+\.|Error:/);
  });

  it("usa mensagem genérica para código desconhecido", () => {
    expect(describeVideoError(undefined)).toMatch(/não foi possível/i);
  });
});
