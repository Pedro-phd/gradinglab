// Exportação: Mediabunny lê o MP4/MOV, decodifica com WebCodecs, cada quadro passa pelo MESMO renderizador da prévia
// (lut-renderer.ts + planPipeline) e volta ao codificador H.264; o áudio é copiado sem recodificar. Roda em Worker
// ou na thread principal. A mídia nunca sai do aparelho e o arquivo de origem só é lido.
import { BlobSource, BufferTarget, canEncodeVideo, Conversion, ConversionCanceledError, EncodedPacketSink, Input, MP4, Mp4OutputFormat, Output, QTFF, Quality, StreamTarget, type InputVideoTrack } from "mediabunny";
import { planPipeline } from "./color-pipeline";
import { checkSupport, countPlayedPackets, exportError, planExport, rotatedSize, type ExportColor, type ExportErrorCode, type ExportSource, withTimeout } from "./export-plan";
import type { ExportAction } from "./export-state";
import { createLutRenderer, type RenderCanvas } from "./lut-renderer";

export type ExportRequest = {
  file: File;
  color: ExportColor;
  /** Arquivo temporário na raiz do armazenamento local do navegador (OPFS), para gravar sem manter tudo na memória. */
  // Só o nome: o Safari não deixa enviar o FileSystemFileHandle ao worker (DataCloneError); quem exporta abre o arquivo.
  tempName: string | null;
};

class ExportFailure extends Error {
  constructor(readonly code: ExportErrorCode) {
    super(code);
  }
}

const PROGRESS_INTERVAL_MS = 100;
const STORAGE_TIMEOUT_MS = 5000;
const QUALITY = new Quality("very-high"); // o mesmo valor vai ao codificador e à verificação de suporte

// Cancelar ou falhar nunca deixa o temporário: quem grava é este código, então é ele quem apaga (antes de avisar a tela).
async function discardTemp(name: string | null) {
  if (!name) return;
  try {
    await (await navigator.storage.getDirectory()).removeEntry(name);
  } catch {
    // já removido ou nunca criado
  }
}

async function readSource(input: Input, track: InputVideoTrack): Promise<ExportSource> {
  const [squareWidth, squareHeight, rotation, stats, duration, config, colorSpace, audio, first] = await Promise.all([
    track.getSquarePixelWidth(), track.getSquarePixelHeight(), track.getRotation(), track.computePacketStats(),
    track.computeDuration(), track.getDecoderConfig(), track.getColorSpace(), input.getPrimaryAudioTrack(), input.getFirstTimestamp(),
  ]);
  const [width, height] = rotatedSize(squareWidth, squareHeight, rotation);
  // Esperado = o que a Conversion entrega, não todos os pacotes do arquivo.
  const totalFrames = await countPlayedPackets(new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true }), first);
  return {
    width, height, rotation, frameRate: stats.averagePacketRate, durationSeconds: duration, totalFrames,
    hasAudio: audio !== null, codec: config?.codec ?? null, transfer: colorSpace.transfer ?? null,
  };
}

function createCanvas(): RenderCanvas {
  return typeof document === "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
}

// Falhas são mostradas como motivo legível; nada de stack, nome de arquivo ou conteúdo da mídia.
export async function runExport(request: ExportRequest, signal: AbortSignal, send: (action: ExportAction) => void) {
  let stage = "início";
  const emit = (action: ExportAction) => {
    if (action.type === "stage") stage = action.stage;
    else if (action.type === "prepared") stage = "conversão";
    send(action);
  };
  const input = new Input({ source: new BlobSource(request.file), formats: [MP4, QTFF] });
  let renderer: ReturnType<typeof createLutRenderer> = null;
  let handle: FileSystemFileHandle | null = null;
  let writable: WritableStream | null = null;
  let output: Output | null = null;
  let conversion: Conversion | null = null;
  let canceling: Promise<void> | null = null;
  let started = false; // depois de execute() o Mediabunny é dono do writable
  const onAbort = () => void (canceling ??= conversion ? conversion.cancel().catch(() => undefined) : null);
  try {
    emit({ type: "stage", stage: "Lendo o vídeo…" });
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new ExportFailure("container_unsupported");
    const plan = planExport(await readSource(input, track), request.color);
    const { color, ...summary } = plan;
    emit({ type: "stage", stage: "Verificando o suporte do aparelho…" });
    const unsupported = await checkSupport({
      webCodecs: typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined",
      canDecode: () => track.canDecode(),
      canEncode: (width, height) => canEncodeVideo("avc", { width, height, quality: QUALITY }),
    }, plan);
    if (unsupported) throw new ExportFailure(unsupported.code);

    // O mesmo plano de cor da prévia. Sem divisor nem modo de comparação: sai sempre o "depois".
    emit({ type: "stage", stage: "Preparando o look…" });
    const canvas = createCanvas();
    renderer = createLutRenderer(canvas, null, () => undefined);
    if (!renderer) throw new ExportFailure("webgl_unavailable");
    const colorPlan = planPipeline(color.profile, color.lutExpectsLog);
    renderer.setLayers(color.layers);
    renderer.setNormalization({ normalizedBase: colorPlan.normalizedBase, lookInput: colorPlan.normalize, lut: color.normalizationLut });

    // Em disco, quando o navegador deixa; senão fica na memória (a tela avisa quando o original é grande).
    // Com limite de tempo: se o armazenamento não responder, a saída fica na memória em vez de travar em 0%.
    emit({ type: "stage", stage: "Abrindo o arquivo de saída…" });
    const tempName = request.tempName;
    handle = tempName ? await withTimeout(navigator.storage.getDirectory().then((dir) => dir.getFileHandle(tempName)).catch(() => null), STORAGE_TIMEOUT_MS) : null;
    writable = handle && "createWritable" in handle ? await withTimeout(handle.createWritable(), STORAGE_TIMEOUT_MS) : null;
    const target = writable ? new StreamTarget(writable as WritableStream<never>, { chunked: true }) : new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat(), target });

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
        quality: QUALITY,
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
    started = true;
    await conversion.execute();
    // Menos quadros que o esperado nunca vira sucesso: falha aqui, antes de existir arquivo para baixar.
    if (done < plan.totalFrames) throw new ExportFailure("incomplete_output");
    if (!finalizing) emit({ type: "finalizing" });
    const blob = target instanceof BufferTarget ? new Blob([target.buffer ?? new ArrayBuffer(0)], { type: "video/mp4" }) : await handle!.getFile();
    if (target instanceof BufferTarget) await discardTemp(request.tempName); // temporário aberto mas não usado
    emit({ type: "finished", framesWritten: done, output: { blob } });
  } catch (error) {
    // Ordem: parar a conversão e esperar o Mediabunny fechar o arquivo, apagar o temporário e só então avisar a tela.
    // (O Mediabunny trava o writable e, ao cancelar, faz close(): abort() só serve antes de execute().)
    await (canceling ?? conversion?.cancel())?.catch(() => undefined);
    await output?.cancel().catch(() => undefined);
    if (!started) await writable?.abort().catch(() => undefined);
    await discardTemp(request.tempName);
    if (error instanceof ConversionCanceledError || signal.aborted) emit({ type: "cancel" });
    else if (error instanceof ExportFailure) emit({ type: "fail", error: exportError(error.code) });
    else emit({ type: "fail", error: exportError("export_failed", `${stage} — ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`) });
  } finally {
    signal.removeEventListener("abort", onAbort);
    renderer?.dispose();
    input.dispose();
  }
}
