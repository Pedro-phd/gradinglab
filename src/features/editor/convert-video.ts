// Vídeo que o navegador não decodifica (ex.: ProRes no Chrome) é convertido no próprio aparelho para H.264 com o
// ffmpeg.wasm. Nada é enviado: o núcleo vem do próprio app (public/ffmpeg) e o arquivo é lido direto do disco.
//
// O worker é o do pacote @ffmpeg/ffmpeg, servido como arquivo (scripts/copy-ffmpeg.mjs) e falado direto pelo protocolo
// de mensagens dele ({ id, type, data }): a classe FFmpeg do pacote cria o worker com URL dinâmica, que o Turbopack não empacota.

/** A conversão foi cancelada pelo usuário (ou pela troca de vídeo). */
export class ConversionCancelled extends Error {}

const asset = (name: string) => new URL(`/ffmpeg/${name}`, window.location.href).href;

export function convertedName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.mp4`;
}

// O ffmpeg descreve a faixa de vídeo como "yuv422p10le(tv, bt2020nc/bt2020/unknown, progressive)": matriz/primárias/transferência.
const STREAM_COLOR = /Video:.*\((?:tv|pc), ([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)/;
const TRANSFERS: Record<string, string> = { smpte2084: "pq", "arib-std-b67": "hlg" };

export type SourceColor = { matrix: string; primaries: string; transfer: string | null };

/** Cor declarada no arquivo de origem, lida do log do ffmpeg; null quando ele não declara. */
export function parseSourceColor(log: string): SourceColor | null {
  const match = STREAM_COLOR.exec(log);
  if (!match) return null;
  return { matrix: match[1]!, primaries: match[2]!, transfer: match[3] === "unknown" ? null : (TRANSFERS[match[3]!] ?? match[3]!) };
}

export type ConvertedVideo = { file: File; sourceColor: SourceColor | null };

type Reply = { id?: number; type: string; data: unknown };

/** fraction: 0..1 estimado pelo ffmpeg; pode faltar quando ele não conhece a duração. */
export async function convertToH264(file: File, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<ConvertedVideo> {
  if (signal.aborted) throw new ConversionCancelled();
  const worker = new Worker(asset("worker.js"), { type: "module" });
  const pending = new Map<number, { resolve: (data: unknown) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  let log = "";
  const stop = (error: Error) => {
    worker.terminate();
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
  };
  const abort = () => stop(new ConversionCancelled());
  signal.addEventListener("abort", abort);
  worker.onerror = () => stop(new Error("convert_failed"));
  worker.onmessage = ({ data: { id, type, data } }: MessageEvent<Reply>) => {
    if (type === "PROGRESS") {
      const { progress } = data as { progress: number };
      if (Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)));
      return;
    }
    if (type === "LOG") {
      log += `${(data as { message: string }).message}\n`;
      return;
    }
    const waiting = id === undefined ? undefined : pending.get(id);
    if (!waiting || id === undefined) return;
    pending.delete(id);
    if (type === "ERROR") waiting.reject(new Error("convert_failed"));
    else waiting.resolve(data);
  };
  const send = (type: string, data: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, data });
    });
  try {
    await send("LOAD", { coreURL: asset("ffmpeg-core.js"), wasmURL: asset("ffmpeg-core.wasm") });
    // WORKERFS lê o arquivo sob demanda: o original (que pode ter centenas de MB) não é copiado para a memória.
    await send("CREATE_DIR", { path: "/in" });
    await send("MOUNT", { fsType: "WORKERFS", options: { blobs: [{ name: "in", data: file }] }, mountPoint: "/in" });
    // 1ª passada sem saída: só para o ffmpeg descrever a faixa (ele termina com erro, e é esperado).
    await send("EXEC", { args: ["-nostdin", "-i", "/in/in"] });
    const sourceColor = parseSourceColor(log);
    log = "";
    const code = await send("EXEC", {
      args: [
        "-nostdin", "-y",
        "-i", "/in/in",
        "-map", "0:v:0", "-map", "0:a:0?", // só imagem e áudio; faixas de dados do iPhone ficam de fora
        // Sem filtro de cor: os valores (inclusive Apple Log) passam como estão, em 8 bits 4:2:0.
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-pix_fmt", "yuv420p",
        // A matriz YUV da origem vai marcada, para o navegador decodificar os mesmos valores RGB. Primárias e
        // transferência vão como Rec.709 de propósito: marcadas como Rec.2020, o navegador converteria a cor antes do
        // shader; e sem as três marcas o Chrome ignora a matriz.
        ...(sourceColor && sourceColor.matrix !== "unknown" ? ["-colorspace", sourceColor.matrix, "-color_primaries", "bt709", "-color_trc", "bt709"] : []),
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "out.mp4",
      ],
    });
    if (code !== 0) throw new Error("convert_failed");
    const data = await send("READ_FILE", { path: "out.mp4" });
    if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error("convert_failed");
    return { file: new File([data as Uint8Array<ArrayBuffer>], convertedName(file.name), { type: "video/mp4" }), sourceColor };
  } finally {
    signal.removeEventListener("abort", abort);
    worker.terminate();
  }
}
