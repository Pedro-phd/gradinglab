import { describe, expect, it } from "vitest";
import type { CubeLut } from "./cube-lut";
import { checkSupport, exportFileName, isTenBit, needsMemoryWarning, planExport, type ExportColor, type ExportEnv, type ExportSource } from "./export-plan";

const source: ExportSource = {
  width: 1080,
  height: 1920,
  rotation: 90,
  frameRate: 24,
  durationSeconds: 42,
  totalFrames: 1008,
  hasAudio: true,
  codec: "avc1.640028",
  transfer: "bt709",
};

const lut = { size: 2 } as CubeLut;
const color: ExportColor = { profile: "apple-log", lutExpectsLog: true, lut, intensity: 0.8 };

describe("plano de exportação", () => {
  it("mantém resolução, proporção e orientação da origem", () => {
    const plan = planExport(source, color);
    expect([plan.width, plan.height, plan.rotation]).toEqual([1080, 1920, 90]);
  });

  it("mantém a taxa de quadros e a duração da origem", () => {
    const plan = planExport(source, color);
    expect(plan.frameRate).toBe(24);
    expect(plan.durationSeconds).toBe(42);
    expect(plan.totalFrames).toBe(1008);
  });

  it("mantém a faixa de áudio quando existe e segue sem áudio quando não existe", () => {
    expect(planExport({ ...source, hasAudio: true }, color).audio).toBe("copy");
    expect(planExport({ ...source, hasAudio: false }, color).audio).toBe("none");
  });

  it("leva o mesmo perfil, a mesma LUT e a mesma intensidade da prévia", () => {
    const plan = planExport(source, color);
    expect(plan.color).toEqual(color);
    expect(plan.color.lut).toBe(lut);
  });

  it("não tem teto de duração", () => {
    const plan = planExport({ ...source, durationSeconds: 3 * 3600, totalFrames: 3 * 3600 * 24 }, color);
    expect(plan.durationSeconds).toBe(10800);
    expect(plan.totalFrames).toBe(259200);
  });

  it("marca HDR e 10 bits para a tela avisar", () => {
    expect(planExport({ ...source, transfer: "pq" }, color).hdr).toBe(true);
    expect(planExport(source, color).hdr).toBe(false);
    expect(planExport({ ...source, codec: "hvc1.2.4.L120.B0" }, color).tenBit).toBe(true);
    expect(planExport(source, color).tenBit).toBe(false);
  });
});

describe("10 bits", () => {
  it("reconhece perfis de 10 bits pelo codec declarado", () => {
    expect(isTenBit("hvc1.2.4.L153.B0")).toBe(true);
    expect(isTenBit("hev1.2.4.L93.B0")).toBe(true);
    expect(isTenBit("vp09.02.10.10")).toBe(true);
    expect(isTenBit("av01.0.08M.10")).toBe(true);
    expect(isTenBit("hvc1.1.6.L93.B0")).toBe(false);
    expect(isTenBit("avc1.640028")).toBe(false);
    expect(isTenBit("av01.0.08M.08")).toBe(false);
    expect(isTenBit(null)).toBe(false);
  });
});

const env = (overrides: Partial<ExportEnv> = {}): ExportEnv => ({
  webCodecs: true,
  canDecode: () => Promise.resolve(true),
  canEncode: () => Promise.resolve(true),
  ...overrides,
});

describe("suporte", () => {
  const plan = planExport(source, color);

  it("com tudo disponível não há erro", async () => {
    expect(await checkSupport(env(), plan)).toBeNull();
  });

  it("configuração não suportada vira erro com motivo legível", async () => {
    const error = await checkSupport(env({ canEncode: () => Promise.resolve(false) }), plan);
    expect(error?.code).toBe("encoder_unsupported");
    expect(error?.message).toMatch(/H\.264/);
    expect(error?.message).not.toMatch(/at |stack/i);
  });

  it("verifica o codificador com a resolução do plano", async () => {
    let asked: [number, number] | null = null;
    await checkSupport(env({ canEncode: (w, h) => { asked = [w, h]; return Promise.resolve(true); } }), plan);
    expect(asked).toEqual([1080, 1920]);
  });

  it("navegador sem WebCodecs vira erro com motivo legível", async () => {
    expect((await checkSupport(env({ webCodecs: false }), plan))?.code).toBe("webcodecs_unavailable");
  });

  it("decodificador sem suporte ao codec do arquivo vira erro", async () => {
    expect((await checkSupport(env({ canDecode: () => Promise.resolve(false) }), plan))?.code).toBe("decoder_unsupported");
  });

  it("HDR não é exportado como SDR em silêncio", async () => {
    expect((await checkSupport(env(), planExport({ ...source, transfer: "hlg" }, color)))?.code).toBe("hdr_unsupported");
  });
});

describe("arquivo de saída", () => {
  it("deriva o nome do original e do look, sem extensão duplicada", () => {
    expect(exportFileName("IMG_4127.MOV", "Entardecer_Quente.cube")).toBe("IMG_4127-Entardecer_Quente.mp4");
    expect(exportFileName("a.b.mp4", null)).toBe("a.b-com-look.mp4");
  });

  it("troca caracteres que nomes de arquivo não aceitam", () => {
    expect(exportFileName("a/b:c.mov", 'x"y.cube')).toBe("a-b-c-x-y.mp4");
  });
});

describe("memória", () => {
  it("avisa sobre vídeos grandes só quando a saída precisa caber na memória", () => {
    expect(needsMemoryWarning(2 * 1024 ** 3, false)).toBe(true);
    expect(needsMemoryWarning(2 * 1024 ** 3, true)).toBe(false);
    expect(needsMemoryWarning(50 * 1024 ** 2, false)).toBe(false);
  });
});
