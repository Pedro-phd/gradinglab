"use client";

import { useEffect, useRef, useState, type RefObject, type SyntheticEvent } from "react";
import { createLutRenderer, type LutRenderer } from "./lut-renderer";
import type { CubeLut } from "./cube-lut";
import type { LutLayer } from "./lut-state";
import type { FrameColorInfo } from "./color-pipeline";
import { formatDuration } from "./local-video";
import { compareView, nextTime, type CompareMode } from "./compare";
import { CompareOverlay } from "./compare-overlay";

/** Quadro da prévia só com o "depois", e a proporção dele. */
export type Snapshot = { url: string; aspect: number };

type Props = {
  src: string;
  autoPlay: boolean;
  layers: LutLayer[]; // pilha na ordem de aplicação, com a intensidade de cada uma (0..1)
  lutName: string | null; // rótulo da pilha: nome da LUT ou "N LUTs"
  intensityPercent: number | null; // só para o rótulo "Depois"; null quando há várias LUTs
  awaitingProfile: boolean; // perfil não confirmado: o look não é aplicado
  normalizedBase: boolean; // o "antes" é o Apple Log convertido para Rec.709
  normalizedLookInput: boolean; // a LUT recebe a imagem convertida
  normalizationLut: CubeLut | null; // tabela da Apple que faz a conversão; null enquanto carrega
  onFrameColor: (info: FrameColorInfo | null) => void; // o que o navegador informa sobre o quadro
  onPausedFrame: (video: HTMLVideoElement | null) => void; // quadro parado para as miniaturas da galeria; null enquanto toca
  unsupported: boolean; // sem WebGL2: vídeo puro, com os controles nativos
  mode: CompareMode;
  /** Preenchido aqui: devolve o quadro atual com o look (JPEG), para a tela de exportação. */
  snapshotRef: RefObject<(() => Snapshot | null) | null>;
  onUnsupported: () => void;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onVideoError: (event: SyntheticEvent<HTMLVideoElement>) => void;
};

// Só o que o navegador declara sobre o espaço de cor do quadro; sem VideoFrame (ou sem quadro) não há dado.
function readFrameColor(video: HTMLVideoElement): FrameColorInfo | null {
  if (typeof VideoFrame === "undefined") return null;
  try {
    const frame = new VideoFrame(video);
    const { primaries, transfer } = frame.colorSpace;
    frame.close();
    return { primaries, transfer };
  } catch {
    return null;
  }
}

// O <video> segue como fonte dos quadros e do áudio, mas quem aparece é o canvas com a LUT.
// Remontado a cada vídeo (key): ao sair, o efeito cancela o callback de quadros e libera a GPU.
export function LutPreview({ src, autoPlay, layers, lutName, intensityPercent, awaitingProfile, normalizedBase, normalizedLookInput, normalizationLut, onFrameColor, onPausedFrame, unsupported, mode, snapshotRef, onUnsupported, onLoadedMetadata, onVideoError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // começa mudo para o autoplay ser aceito
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [split, setSplit] = useState(0.5);
  const [aspect, setAspect] = useState(16 / 9); // largura/altura do vídeo, para a caixa da imagem acompanhar o quadro
  const view = compareView(mode, split, { lutName, intensityPercent, normalizedBase, awaitingProfile });
  const { split: shaderSplit, showOriginal } = view.uniforms;
  const compareRef = useRef({ split: shaderSplit, showOriginal });

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const renderer = createLutRenderer(canvas, video, onUnsupported);
    if (!renderer) {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;
    // Desenha e lê na mesma tarefa: o buffer do WebGL ainda tem o quadro, sem precisar de preserveDrawingBuffer.
    // Só o "depois" (divisor em 0); depois volta a comparação que estava na tela.
    snapshotRef.current = () => {
      renderer.setCompare(0, false);
      renderer.draw();
      try {
        return { url: canvas.toDataURL("image/jpeg", 0.85), aspect: canvas.width / canvas.height };
      } catch {
        return null;
      } finally {
        renderer.setCompare(compareRef.current.split, compareRef.current.showOriginal);
        renderer.draw();
      }
    };

    // Um quadro por callback do vídeo; sem requestVideoFrameCallback, um por quadro de tela.
    const hasVideoCallback = "requestVideoFrameCallback" in video;
    let handle = 0;
    const loop = () => {
      renderer.draw();
      handle = hasVideoCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    loop();
    // Pausado, o callback não dispara: redesenha ao carregar o primeiro quadro e depois de buscar.
    const reportPaused = () => onPausedFrame(video.paused ? video : null);
    const onLoadedData = () => {
      renderer.draw();
      onFrameColor(readFrameColor(video));
      reportPaused();
    };
    const onSeeked = () => {
      renderer.draw();
      reportPaused();
    };
    const onPlay = () => onPausedFrame(null);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("pause", reportPaused);
    video.addEventListener("play", onPlay);

    return () => {
      if (hasVideoCallback) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("pause", reportPaused);
      video.removeEventListener("play", onPlay);
      onPausedFrame(null);
      snapshotRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onUnsupported, onFrameColor, onPausedFrame, snapshotRef]);

  // Muda LUT, intensidade, plano de cor ou divisor: redesenha o quadro atual, também com o vídeo pausado.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setLayers(layers);
    compareRef.current = { split: shaderSplit, showOriginal };
    renderer.setCompare(shaderSplit, showOriginal);
    renderer.setNormalization({ normalizedBase, lookInput: normalizedLookInput, lut: normalizationLut });
    renderer.draw();
  }, [layers, shaderSplit, showOriginal, normalizedBase, normalizedLookInput, normalizationLut]);

  // Lê o vídeo na hora: o updater do setState roda depois e o evento já não vale mais.
  function syncTime(video: HTMLVideoElement) {
    const { currentTime, duration } = video;
    setTime({ current: currentTime, duration: Number.isFinite(duration) ? duration : 0 });
  }

  function togglePlay() {
    const video = videoRef.current;
    if (video?.paused) video.play().catch(() => undefined);
    else video?.pause();
  }

  const roundButton = "flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white";
  const disc = "flex size-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-md";

  return (
    // container de tamanho: a caixa da imagem cabe inteira no espaço livre, na proporção do vídeo.
    <div style={{ containerType: "size" }} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
      {unsupported && (
        <p role="alert" className="absolute inset-x-0 top-0 z-10 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          Este navegador não oferece WebGL2, necessário para mostrar o look na prévia. O vídeo aparece sem a LUT. Nada é enviado a servidor.
        </p>
      )}
      <div
        style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}
        className={`relative overflow-hidden rounded-[22px] bg-surface-2 ${unsupported ? "hidden" : ""}`}
      >
        <canvas ref={canvasRef} role="img" aria-label="Prévia do vídeo com o look aplicado" className="block h-full w-full" />
        <CompareOverlay view={view} split={split} onSplit={setSplit} />
        <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1">
          <button type="button" aria-label={playing ? "Pausar" : "Reproduzir"} onClick={togglePlay} className={roundButton}>
            <span className={disc}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4l13 8-13 8z" />}</svg>
            </span>
          </button>
          <input
            type="range"
            aria-label="Posição no vídeo"
            min={0}
            aria-valuetext={formatDuration(time.current)}
            max={time.duration}
            step="any" // arrasto sem perder precisão; as setas andam 1 s (onKeyDown)
            value={Math.min(time.current, time.duration)}
            disabled={!(time.duration > 0)}
            onChange={(event) => {
              if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
            }}
            onKeyDown={(event) => {
              const seconds = nextTime(time.current, event.key, time.duration);
              if (seconds === null || !videoRef.current) return;
              event.preventDefault();
              videoRef.current.currentTime = seconds;
            }}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-white focus-visible:outline-2 focus-visible:outline-white"
          />
          <span className="px-1 text-xs tabular-nums text-foreground/85">{formatDuration(time.current)} / {formatDuration(time.duration)}</span>
          <button type="button" aria-label={muted ? "Ativar som" : "Silenciar"} aria-pressed={!muted} onClick={() => videoRef.current && (videoRef.current.muted = !muted)} className={roundButton}>
            <span className={disc}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9z" />
                {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" />}
              </svg>
            </span>
          </button>
        </div>
      </div>
      {/* Sem display:none: alguns navegadores deixam de entregar quadros a vídeo oculto. */}
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        muted onVolumeChange={(event) => setMuted(event.currentTarget.muted)} playsInline
        preload="metadata"
        controls={unsupported}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) setAspect(videoWidth / videoHeight);
          syncTime(event.currentTarget);
          onLoadedMetadata(event);
        }}
        onTimeUpdate={(event) => syncTime(event.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={onVideoError}
        className={unsupported ? "max-h-full w-full rounded-[22px] bg-black" : "pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"}
      />
    </div>
  );
}
