import { describe, expect, it } from "vitest";
import { convertedName, parseSourceColor } from "./convert-video";

describe("cor da origem lida do log do ffmpeg", () => {
  it("lê matriz, primárias e transferência de um ProRes Apple Log", () => {
    const log = "  Stream #0:0[0x1](und): Video: prores (HQ) (apch / 0x68637061), yuv422p10le(tv, bt2020nc/bt2020/unknown, progressive), 1920x1080, 344295 kb/s";
    expect(parseSourceColor(log)).toEqual({ matrix: "bt2020nc", primaries: "bt2020", transfer: null });
  });

  it("traduz as transferências HDR para os nomes do navegador", () => {
    expect(parseSourceColor("Video: hevc, yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67), 1920x1080")?.transfer).toBe("hlg");
    expect(parseSourceColor("Video: hevc, yuv420p10le(tv, bt2020nc/bt2020/smpte2084), 1920x1080")?.transfer).toBe("pq");
  });

  it("sem cor declarada devolve null", () => {
    expect(parseSourceColor("Video: h264 (High), yuv420p(progressive), 1920x1080")).toBeNull();
    expect(parseSourceColor("")).toBeNull();
  });
});

describe("nome da cópia convertida", () => {
  it("troca a extensão por .mp4", () => {
    expect(convertedName("IMG_7619.MOV")).toBe("IMG_7619.mp4");
  });
});
