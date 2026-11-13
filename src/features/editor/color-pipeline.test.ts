import { describe, expect, it } from "vitest";
import { normalizeAppleLog } from "./apple-log";
import { chooseProfile, isHdrFrame, planPipeline, suggestProfile } from "./color-pipeline";
import { mixIntensity } from "./lut-math";

describe("decisão do pipeline de cor", () => {
  it("Apple Log + LUT que espera imagem normalizada: converte e depois aplica o look", () => {
    expect(planPipeline("apple-log", false)).toMatchObject({ normalize: true, applyLook: true, intensityAvailable: true });
  });

  it("Apple Log + LUT que já espera Log: não converte antes da LUT, mas o antes continua normalizado", () => {
    const plan = planPipeline("apple-log", true);
    expect(plan.normalize).toBe(false);
    expect(plan.normalizedBase).toBe(true);
    expect(plan.applyLook).toBe(true);
  });

  it("Normal: nunca aplica conversão de Log", () => {
    for (const lutExpectsLog of [false, true]) {
      const plan = planPipeline("normal", lutExpectsLog);
      expect(plan.normalize).toBe(false);
      expect(plan.normalizedBase).toBe(false);
      expect(plan.applyLook).toBe(true);
    }
  });

  it("Normal + 'LUT já espera Log': combinação incompatível recebe aviso", () => {
    expect(planPipeline("normal", true).warning?.code).toBe("lut_expects_log_on_normal_source");
    expect(planPipeline("normal", false).warning).toBeNull();
    expect(planPipeline("apple-log", true).warning).toBeNull();
  });

  it("Não sei: bloqueia a aplicação do look até o usuário confirmar um perfil", () => {
    for (const lutExpectsLog of [false, true]) {
      const plan = planPipeline("unknown", lutExpectsLog);
      expect(plan).toMatchObject({ applyLook: false, requiresConfirmation: true, intensityAvailable: false, normalize: false, normalizedBase: false });
    }
  });
});

describe("sugestão de perfil", () => {
  it("sem informação confiável, o perfil inicial é 'unknown'", () => {
    expect(suggestProfile(null)).toEqual({ profile: "unknown", source: "none" });
    expect(suggestProfile({ primaries: null, transfer: null })).toEqual({ profile: "unknown", source: "none" });
  });

  it("Rec.2020 sem HDR é sugerido como Apple Log, marcado como vindo dos metadados", () => {
    // A função só recebe o que o navegador informa sobre o quadro: nome e pixels não entram.
    expect(suggestProfile({ primaries: "bt2020", transfer: "bt709" })).toEqual({ profile: "apple-log", source: "metadata" });
    expect(suggestProfile({ primaries: "bt2020", transfer: null }).profile).toBe("apple-log");
  });

  it("Rec.2020 HDR e Rec.709 não são sugeridos como Apple Log", () => {
    expect(suggestProfile({ primaries: "bt2020", transfer: "hlg" }).profile).toBe("unknown");
    expect(suggestProfile({ primaries: "bt2020", transfer: "pq" }).profile).toBe("unknown");
    expect(suggestProfile({ primaries: "bt709", transfer: "bt709" }).profile).toBe("unknown");
  });

  it("escolha manual substitui a sugestão e fica marcada como manual", () => {
    expect(chooseProfile("apple-log")).toEqual({ profile: "apple-log", source: "manual" });
    expect(chooseProfile("unknown").source).toBe("manual");
  });
});

describe("HDR", () => {
  it("reconhece transferências HDR informadas pelo navegador", () => {
    expect(isHdrFrame({ primaries: "bt2020", transfer: "pq" })).toBe(true);
    expect(isHdrFrame({ primaries: "bt2020", transfer: "hlg" })).toBe(true);
    expect(isHdrFrame({ primaries: "bt709", transfer: "bt709" })).toBe(false);
    expect(isHdrFrame(null)).toBe(false);
  });
});

describe("intensidade com normalização", () => {
  it("0% é igual à base normalizada", () => {
    const frame: [number, number, number] = [0.5, 0.4, 0.3];
    const base = normalizeAppleLog(frame);
    expect(mixIntensity(base, [0.9, 0.1, 0.5], 0)).toEqual(base);
  });
});
