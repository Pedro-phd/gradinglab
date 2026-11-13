"use client";

import { useEffect, useRef, useState } from "react";
import { createLutRenderer, type LutRenderer, type Normalization } from "./lut-renderer";
import { MAX_STACKED_LUTS, type LutLayer } from "./lut-state";
import type { CubeLut } from "./cube-lut";

// Cartão tem ~170 px CSS; 480 cobre telas de densidade 2x–3x sem serrilhado.
const THUMB_WIDTH = 480;

export type ThumbnailInput = {
  /** Vídeo pausado no quadro das miniaturas; null enquanto toca. */
  video: HTMLVideoElement | null;
  /** Muda a cada novo quadro pausado (pausa, busca, troca de vídeo). */
  frameVersion: number;
  base: LutLayer[]; // a pilha atual
  normalization: Normalization;
  candidates: { id: string; lut: CubeLut }[];
  enabled: boolean; // perfil confirmado e WebGL2 disponível
};

/**
 * Miniatura = quadro pausado → pilha atual → LUT candidata a 100%, pelo MESMO renderizador da prévia.
 * Um canvas WebGL fora da tela desenha em resolução cheia e um canvas 2D reduz para JPEG.
 * Uma miniatura por quadro de tela, para não travar a interface.
 */
export function useLookThumbnails({ video, frameVersion, base, normalization, candidates, enabled }: ThumbnailInput) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const rendererRef = useRef<{ video: HTMLVideoElement; renderer: LutRenderer; canvas: HTMLCanvasElement } | null>(null);

  useEffect(() => () => rendererRef.current?.renderer.dispose(), []);

  useEffect(() => {
    if (!enabled || !video || video.readyState < 2 || video.videoWidth === 0) return;
    if (rendererRef.current?.video !== video) {
      rendererRef.current?.renderer.dispose();
      const canvas = document.createElement("canvas");
      const renderer = createLutRenderer(canvas, video, () => undefined);
      rendererRef.current = renderer ? { video, renderer, canvas } : null;
    }
    const current = rendererRef.current;
    if (!current) return;
    const { renderer, canvas } = current;
    const small = document.createElement("canvas");
    small.width = THUMB_WIDTH;
    small.height = Math.round((THUMB_WIDTH * video.videoHeight) / video.videoWidth);
    const context = small.getContext("2d");
    if (!context) return;
    context.imageSmoothingQuality = "high"; // o padrão ("low") serrilha ao reduzir de 1080p/4K
    // Mesmo limite da pilha: a candidata ocupa a última posição.
    const kept = base.slice(0, MAX_STACKED_LUTS - 1);
    let index = 0;
    let handle = 0;
    const step = () => {
      const candidate = candidates[index];
      if (!candidate) return;
      renderer.setLayers([...kept, { lut: candidate.lut, intensity: 1 }]);
      renderer.setNormalization(normalization);
      renderer.setCompare(0, false);
      renderer.draw();
      // Lido na mesma tarefa do desenho: o buffer do WebGL ainda vale sem preserveDrawingBuffer.
      context.drawImage(canvas, 0, 0, small.width, small.height);
      const url = small.toDataURL("image/jpeg", 0.9);
      setThumbs((previous) => ({ ...previous, [candidate.id]: url }));
      index += 1;
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [video, frameVersion, base, normalization, candidates, enabled]);

  return thumbs;
}
