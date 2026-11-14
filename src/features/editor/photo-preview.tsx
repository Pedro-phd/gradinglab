"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createLutRenderer, type LutRenderer } from "./lut-renderer";
import type { CubeLut } from "./cube-lut";
import type { Effects } from "./effects";
import type { LutLayer } from "./lut-state";
import { compareView, type CompareMode } from "./compare";
import { CompareOverlay } from "./compare-overlay";
import type { Snapshot } from "./lut-preview";

type Props = {
  preview: HTMLCanvasElement; // cópia reduzida da foto (photo.ts)
  layers: LutLayer[];
  lutName: string | null;
  intensityPercent: number | null;
  awaitingProfile: boolean;
  normalizedBase: boolean;
  normalizedLookInput: boolean;
  normalizationLut: CubeLut | null;
  softHighlights: boolean;
  effects: Effects;
  unsupported: boolean;
  mode: CompareMode;
  snapshotRef: RefObject<(() => Snapshot | null) | null>;
  onUnsupported: () => void;
};

// Mesma caixa e comparação da prévia de vídeo, sem controles de tempo: redesenha só quando algo muda.
export function PhotoPreview({ preview, layers, lutName, intensityPercent, awaitingProfile, normalizedBase, normalizedLookInput, normalizationLut, softHighlights, effects, unsupported, mode, snapshotRef, onUnsupported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const [split, setSplit] = useState(0.5);
  const aspect = preview.width / preview.height;
  const view = compareView(mode, split, { lutName, intensityPercent, normalizedBase, awaitingProfile });
  const { split: shaderSplit, showOriginal } = view.uniforms;
  const compareRef = useRef({ split: shaderSplit, showOriginal });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createLutRenderer(canvas, null, onUnsupported, { still: true });
    if (!renderer) {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;
    snapshotRef.current = () => {
      renderer.setCompare(0, false);
      renderer.drawFrame(preview);
      try {
        return { url: canvas.toDataURL("image/jpeg", 0.85), aspect };
      } catch {
        return null;
      } finally {
        renderer.setCompare(compareRef.current.split, compareRef.current.showOriginal);
        renderer.drawFrame(preview);
      }
    };
    return () => {
      snapshotRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [preview, aspect, onUnsupported, snapshotRef]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setLayers(layers);
    compareRef.current = { split: shaderSplit, showOriginal };
    renderer.setCompare(shaderSplit, showOriginal);
    renderer.setNormalization({ normalizedBase, lookInput: normalizedLookInput, lut: normalizationLut, softHighlights });
    renderer.setEffects(effects);
    renderer.drawFrame(preview);
  }, [preview, layers, shaderSplit, showOriginal, normalizedBase, normalizedLookInput, normalizationLut, softHighlights, effects]);

  return (
    <div style={{ containerType: "size" }} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
      {unsupported && (
        <p role="alert" className="absolute inset-x-0 top-0 z-10 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          Este navegador não oferece WebGL2, necessário para aplicar o look. Nada é enviado a servidor.
        </p>
      )}
      <div style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }} className={`relative overflow-hidden rounded-[22px] bg-surface-2 ${unsupported ? "hidden" : ""}`}>
        <canvas ref={canvasRef} role="img" aria-label="Prévia da foto com o look aplicado" className="block h-full w-full" />
        <CompareOverlay view={view} split={split} onSplit={setSplit} />
      </div>
    </div>
  );
}
