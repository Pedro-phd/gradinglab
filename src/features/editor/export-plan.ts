// Plano e verificação de suporte da exportação, sem DOM, WebCodecs nem Mediabunny: as APIs entram injetadas.
import type { CubeLut } from "./cube-lut";
import type { LutLayer } from "./lut-state";
import { isHdrFrame, type SourceProfile } from "./color-pipeline";

/** O que o contêiner diz sobre o vídeo. width/height já são as dimensões exibidas (com a rotação aplicada). */
export type ExportSource = {
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  frameRate: number; // média; a exportação preserva o instante de cada quadro, então vale também para taxa variável
  durationSeconds: number;
  totalFrames: number;
  hasAudio: boolean;
  codec: string | null; // string de codec do decodificador, ex.: hvc1.2.4.L120.B0
  transfer: string | null; // transferência de cor declarada; pq/hlg = HDR
};

/** Dimensões exibidas: a rotação de 90/270 troca largura e altura (a mesma regra do Mediabunny). */
export function rotatedSize(width: number, height: number, rotation: ExportSource["rotation"]): [number, number] {
  return rotation % 180 === 0 ? [width, height] : [height, width];
}

/**
 * Quadros que a conversão realmente entrega: a Conversion descarta pacotes que terminam antes do início real
 * (corte com `-c copy`, edit list), então só contam os que passam de max(primeiro instante, 0).
 */
export async function countPlayedPackets(packets: AsyncIterable<{ timestamp: number; duration: number }>, firstTimestamp: number): Promise<number> {
  const start = Math.max(firstTimestamp, 0);
  let count = 0;
  for await (const packet of packets) if (packet.timestamp + packet.duration > start) count += 1;
  return count;
}

/** Estado de cor do editor no momento do clique: é o que a prévia usa. */
export type ExportColor = { profile: SourceProfile; lutExpectsLog: boolean; layers: LutLayer[]; normalizationLut?: CubeLut | null };

export type ExportPlan = {
  container: "mp4";
  videoCodec: "avc";
  width: number;
  height: number;
  rotation: ExportSource["rotation"]; // da origem; a saída traz a rotação aplicada nos quadros
  frameRate: number;
  durationSeconds: number;
  totalFrames: number;
  audio: "copy" | "none";
  color: ExportColor;
  hdr: boolean;
  tenBit: boolean;
};

/** O plano sem a cor (que carrega as LUTs): é o que a tela mostra. */
export type ExportSummary = Omit<ExportPlan, "color">;

export type ExportErrorCode =
  | "webcodecs_unavailable"
  | "decoder_unsupported"
  | "encoder_unsupported"
  | "hdr_unsupported"
  | "container_unsupported"
  | "webgl_unavailable"
  | "track_discarded"
  | "incomplete_output"
  | "export_failed";

export type ExportError = { code: ExportErrorCode; message: string };

const MESSAGES: Record<ExportErrorCode, string> = {
  webcodecs_unavailable: "Este navegador não tem WebCodecs, necessário para exportar o vídeo. Use uma versão recente do Chrome, Edge ou Safari. Nada foi enviado.",
  decoder_unsupported: "Este navegador não consegue decodificar o formato deste vídeo, então a exportação não é possível aqui. O original continua intacto.",
  encoder_unsupported: "Este aparelho ou navegador não consegue gerar MP4 com H.264 nesta resolução. O original continua intacto.",
  hdr_unsupported: "Este vídeo é HDR (PQ ou HLG). A exportação ainda só tem saída SDR e não converte HDR em silêncio. O original continua intacto.",
  container_unsupported: "Por enquanto só dá para exportar vídeos MP4 ou MOV com imagem legível. O original continua intacto.",
  webgl_unavailable: "Não foi possível preparar o WebGL2 para aplicar o look na exportação. O original continua intacto.",
  track_discarded: "Uma das faixas do vídeo (imagem ou áudio) não pôde ser gravada neste navegador. Para não entregar um arquivo sem ela, a exportação foi interrompida.",
  incomplete_output: "A exportação terminou com quadros faltando, então o arquivo foi descartado. Tente de novo.",
  export_failed: "A exportação falhou no meio do caminho e nada foi baixado. O original continua intacto. Tente de novo ou use um vídeo menor.",
};

export function exportError(code: ExportErrorCode): ExportError {
  return { code, message: MESSAGES[code] };
}

// Pelo codec declarado: HEVC Main10 (perfil 2), VP9 perfis 2 e 3, AV1 com 10 bits. Sem a declaração, não afirma nada.
export function isTenBit(codec: string | null): boolean {
  if (!codec) return false;
  const parts = codec.split(".");
  switch (parts[0]) {
    case "hvc1":
    case "hev1":
      return parts[1] === "2";
    case "vp09":
      return parts[1] === "02" || parts[1] === "03";
    case "av01":
      return parts[3] === "10" || parts[3] === "12";
    default:
      return false;
  }
}

export function planExport(source: ExportSource, color: ExportColor): ExportPlan {
  return {
    container: "mp4",
    videoCodec: "avc",
    width: source.width,
    height: source.height,
    rotation: source.rotation,
    frameRate: source.frameRate,
    durationSeconds: source.durationSeconds, // sem teto: só o aparelho decide se dá conta
    totalFrames: source.totalFrames,
    audio: source.hasAudio ? "copy" : "none",
    color,
    hdr: isHdrFrame({ transfer: source.transfer }),
    tenBit: isTenBit(source.codec),
  };
}

export type ExportEnv = {
  webCodecs: boolean;
  canDecode(): Promise<boolean>; // o codec real do arquivo
  canEncode(width: number, height: number): Promise<boolean>; // H.264 na resolução do plano
};

/** null = pode exportar. Verifica antes de decodificar o primeiro quadro. */
export async function checkSupport(env: ExportEnv, plan: ExportPlan): Promise<ExportError | null> {
  if (!env.webCodecs) return exportError("webcodecs_unavailable");
  if (plan.hdr) return exportError("hdr_unsupported");
  if (!(await env.canDecode())) return exportError("decoder_unsupported");
  if (!(await env.canEncode(plan.width, plan.height))) return exportError("encoder_unsupported");
  return null;
}

// Nome do original + nome da LUT; sem LUT, "com-look". Sempre .mp4: o arquivo baixado nunca substitui o original.
export function exportFileName(videoName: string, lutName: string | null): string {
  const base = (name: string) => name.replace(/\.[^.]*$/, "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");
  return `${base(videoName)}-${lutName ? base(lutName) : "com-look"}.mp4`;
}

/** null quando a promessa não responde a tempo: o armazenamento local de alguns navegadores trava sem erro. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

const MEMORY_WARNING_BYTES = 1024 ** 3;

/** Sem gravação incremental em disco, a saída inteira fica na memória: avisa quando o original já é grande. */
export function needsMemoryWarning(sourceBytes: number, incrementalStorage: boolean): boolean {
  return !incrementalStorage && sourceBytes > MEMORY_WARNING_BYTES;
}
