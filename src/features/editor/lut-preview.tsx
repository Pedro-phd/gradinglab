"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { createLutRenderer, type LutRenderer } from "./lut-renderer";
import type { CubeLut } from "./cube-lut";
import { formatDuration } from "./local-video";

type Props = {
  src: string;
  autoPlay: boolean;
  lut: CubeLut | null;
  intensity: number; // fração 0..1 do look
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onVideoError: (event: SyntheticEvent<HTMLVideoElement>) => void;
};

// O <video> segue como fonte dos quadros e do áudio, mas quem aparece é o canvas com a LUT.
// Remontado a cada vídeo (key): ao sair, o efeito cancela o callback de quadros e libera a GPU.
export function LutPreview({ src, autoPlay, lut, intensity, onLoadedMetadata, onVideoError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const renderer = createLutRenderer(canvas, video);
    if (!renderer) {
      setUnsupported(true);
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
    video.addEventListener("loadeddata", renderer.draw);
    video.addEventListener("seeked", renderer.draw);

    return () => {
      if (hasVideoCallback) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      video.removeEventListener("loadeddata", renderer.draw);
      video.removeEventListener("seeked", renderer.draw);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Muda LUT ou intensidade: redesenha o quadro atual, também com o vídeo pausado.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setLut(lut);
    renderer.setIntensity(intensity);
    renderer.draw();
  }, [lut, intensity]);

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
      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Prévia do vídeo com o look aplicado"
          className={`max-h-[70vh] w-full rounded-[28px] bg-black object-contain ${unsupported ? "hidden" : ""}`}
        />
        {/* Sem display:none: alguns navegadores deixam de entregar quadros a vídeo oculto. */}
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          muted
          playsInline
          preload="metadata"
          controls={unsupported}
          onLoadedMetadata={(event) => {
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
            max={time.duration}
            step="any"
            value={time.current}
            onChange={(event) => {
              if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
            }}
            className="h-11 min-w-40 flex-1 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          />
          <span className="text-sm tabular-nums text-muted">{formatDuration(time.current)} / {formatDuration(time.duration)}</span>
        </div>
      )}
    </div>
  );
}
