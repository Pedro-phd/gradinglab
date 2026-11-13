"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { createLutRenderer, type LutRenderer } from "./lut-renderer";
import type { CubeLut } from "./cube-lut";
import type { LutLayer } from "./lut-state";
import type { FrameColorInfo } from "./color-pipeline";
import { formatDuration } from "./local-video";
import { compareView, nextTime, type CompareMode } from "./compare";
import { CompareOverlay, ModeGroup } from "./compare-overlay";

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
export function LutPreview({ src, autoPlay, layers, lutName, intensityPercent, awaitingProfile, normalizedBase, normalizedLookInput, normalizationLut, onFrameColor, onPausedFrame, unsupported, onUnsupported, onLoadedMetadata, onVideoError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // começa mudo para o autoplay ser aceito
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [mode, setMode] = useState<CompareMode>("compare");
  const [split, setSplit] = useState(0.5);
  const [aspect, setAspect] = useState(16 / 9); // largura/altura do vídeo, para a caixa da imagem acompanhar o quadro
  const view = compareView(mode, split, { lutName, intensityPercent, normalizedBase, awaitingProfile });
  const { split: shaderSplit, showOriginal } = view.uniforms;

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
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onUnsupported, onFrameColor, onPausedFrame]);

  // Muda LUT, intensidade, plano de cor ou divisor: redesenha o quadro atual, também com o vídeo pausado.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setLayers(layers);
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

  return (
    <div className="flex w-full flex-col gap-3">
      {unsupported && (
        <p role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          Este navegador não oferece WebGL2, necessário para mostrar o look na prévia. O vídeo aparece sem a LUT. Nada é enviado a servidor.
        </p>
      )}
      {!unsupported && <ModeGroup mode={mode} onChange={setMode} />}
      <div className="relative flex justify-center">
        {/* A caixa tem a proporção do vídeo (e no máximo 70vh de altura): a fração do divisor vale para a imagem toda. */}
        <div
          style={{ aspectRatio: aspect, width: `min(100%, ${70 * aspect}vh)` }}
          className={`relative overflow-hidden rounded-[28px] bg-black ${unsupported ? "hidden" : ""}`}
        >
          <canvas ref={canvasRef} role="img" aria-label="Prévia do vídeo com o look aplicado" className="block h-full w-full" />
          <CompareOverlay view={view} split={split} onSplit={setSplit} />
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
          className={
            unsupported
              ? "max-h-[70vh] w-full rounded-[28px] bg-black"
              : "pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
          }
        />
      </div>
      {!unsupported && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={togglePlay} className="h-11 min-w-28 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {playing ? "Pausar" : "Reproduzir"}
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
            className="h-11 min-w-40 flex-1 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          />
          <button type="button" aria-pressed={!muted} onClick={() => videoRef.current && (videoRef.current.muted = !muted)} className="h-11 rounded-full border border-white/20 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {muted ? "Ativar som" : "Silenciar"}
          </button>
          <span className="text-sm tabular-nums text-muted">{formatDuration(time.current)} / {formatDuration(time.duration)}</span>
        </div>
      )}
    </div>
  );
}
