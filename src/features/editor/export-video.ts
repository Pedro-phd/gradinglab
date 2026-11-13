// Exportação: Mediabunny lê o MP4/MOV, decodifica com WebCodecs, cada quadro passa pelo MESMO renderizador da prévia
// (lut-renderer.ts + planPipeline) e volta ao codificador H.264; o áudio é copiado sem recodificar. Roda em Worker
// ou na thread principal. A mídia nunca sai do aparelho e o arquivo de origem só é lido.
import { BlobSource, BufferTarget, canEncodeVideo, Conversion, ConversionCanceledError, Input, MP4, Mp4OutputFormat, Output, QTFF, StreamTarget, type InputVideoTrack } from "mediabunny";
import { planPipeline } from "./color-pipeline";
import { checkSupport, exportError, planExport, type ExportColor, type ExportErrorCode, type ExportSource } from "./export-plan";
import type { ExportAction } from "./export-state";
import { createLutRenderer, type RenderCanvas } from "./lut-renderer";

export type ExportRequest = {
  file: File;
  color: ExportColor;
  /** Arquivo temporário no armazenamento local do navegador (OPFS) para gravar sem manter tudo na memória. */
  handle: FileSystemFileHandle | null;
};

class ExportFailure extends Error {
  constructor(readonly code: ExportErrorCode) {
    super(code);
  }
}

const PROGRESS_INTERVAL_MS = 100;

async function readSource(input: Input, track: InputVideoTrack): Promise<ExportSource> {
  const [width, height, rotation, stats, duration, config, colorSpace, audio] = await Promise.all([
    track.getDisplayWidth(), track.getDisplayHeight(), track.getRotation(), track.computePacketStats(),
    track.computeDuration(), track.getDecoderConfig(), track.getColorSpace(), input.getPrimaryAudioTrack(),
  ]);
  return {
    width, height, rotation, frameRate: stats.averagePacketRate, durationSeconds: duration, totalFrames: stats.packetCount,
    hasAudio: audio !== null, codec: config?.codec ?? null, transfer: colorSpace.transfer ?? null,
  };
}

function createCanvas(): RenderCanvas {
  return typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
}

// Falhas são mostradas como motivo legível; nada de stack, nome de arquivo ou conteúdo da mídia.
export async function runExport(request: ExportRequest, signal: AbortSignal, emit: (action: ExportAction) => void) {
  const input = new Input({ source: new BlobSource(request.file), formats: [MP4, QTFF] });
  let renderer: ReturnType<typeof createLutRenderer> = null;
  let writable: WritableStream | null = null;
  let conversion: Conversion | null = null;
  const onAbort = () => void conversion?.cancel().catch(() => undefined);
  try {
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new ExportFailure("container_unsupported");
    const plan = planExport(await readSource(input, track), request.color);
    const { color, ...summary } = plan;
    const unsupported = await checkSupport({
      webCodecs: typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined",
      canDecode: () => track.canDecode(),
      canEncode: (width, height) => canEncodeVideo("avc", { width, height }),
    }, plan);
    if (unsupported) throw new ExportFailure(unsupported.code);

    // O mesmo plano de cor da prévia. Sem divisor nem modo de comparação: sai sempre o "depois".
    const canvas = createCanvas();
    renderer = createLutRenderer(canvas, null, () => undefined);
    if (!renderer) throw new ExportFailure("webgl_unavailable");
    const colorPlan = planPipeline(color.profile, color.lutExpectsLog);
    renderer.setLut(color.lut);
    renderer.setIntensity(color.intensity);
    renderer.setNormalization({ normalizedBase: colorPlan.normalizedBase, lookInput: colorPlan.normalize });

    // Em disco, quando o navegador deixa; senão fica na memória (a tela avisa quando o original é grande).
    writable = request.handle && "createWritable" in request.handle ? await request.handle.createWritable() : null;
    const target = writable ? new StreamTarget(writable as WritableStream<never>, { chunked: true }) : new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });

    emit({ type: "prepared", plan: summary });
    let done = 0;
    let lastEmit = 0;
    let finalizing = false;
    const frameRenderer = renderer;
    conversion = await Conversion.init({
      input,
      output,
      // Sem frameRate: cada quadro mantém o instante original, também em vídeo de taxa variável.
      // Sem opções de áudio: o Mediabunny copia os pacotes originais sem recodificar quando o MP4 os aceita.
      video: {
        codec: "avc",
        processedWidth: plan.width,
        processedHeight: plan.height,
        process(sample) {
          frameRenderer.drawFrame(sample.toCanvasImageSource());
          done += 1;
          const now = performance.now();
          if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
            lastEmit = now;
            emit({ type: "progress", done });
          }
          if (done >= plan.totalFrames && !finalizing) {
            finalizing = true;
            emit({ type: "progress", done });
            emit({ type: "finalizing" });
          }
          return canvas;
        },
      },
    });
    // Imagem ou áudio que não pôde ser gravado: interrompe, em vez de entregar um vídeo sem a faixa.
    const lost = conversion.discardedTracks.find((entry) => entry.reason !== "discarded_by_user");
    if (!conversion.isValid || lost) {
      throw new ExportFailure(lost?.reason === "no_encodable_target_codec" && lost.track.isVideoTrack() ? "encoder_unsupported" : "track_discarded");
    }
    signal.addEventListener("abort", onAbort);
    if (signal.aborted) onAbort();
    await conversion.execute();
    if (!finalizing) emit({ type: "finalizing" });
    const blob = target instanceof BufferTarget ? new Blob([target.buffer ?? new ArrayBuffer(0)], { type: "video/mp4" }) : await request.handle!.getFile();
    emit({ type: "finished", framesWritten: done, output: { blob } });
  } catch (error) {
    if (error instanceof ConversionCanceledError || signal.aborted) emit({ type: "cancel" });
    else emit({ type: "fail", error: exportError(error instanceof ExportFailure ? error.code : "export_failed") });
    await writable?.abort().catch(() => undefined);
  } finally {
    signal.removeEventListener("abort", onAbort);
    renderer?.dispose();
    input.dispose();
  }
}
