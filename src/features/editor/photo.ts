// Foto: abre o arquivo neste aparelho, gera a cópia reduzida da prévia e exporta em resolução cheia, em faixas.
// Mesmo renderizador do vídeo (lut-renderer.ts); a saída é JPEG sRGB, sem metadados (EXIF).
import { planPipeline } from "./color-pipeline";
import type { ExportColor } from "./export-plan";
import { createJpegEncoder } from "./jpeg-encoder";
import { createLutRenderer } from "./lut-renderer";

export type Photo = { image: ImageBitmap | HTMLImageElement; width: number; height: number; preview: HTMLCanvasElement };

const PREVIEW_MAX = 2048; // lado maior da prévia; o brilho da exportação também sai desta cópia
const TILE_PIXELS = 4_000_000; // faixa por vez: cabe no limite de canvas do iOS mesmo com fotos de 48 MP
const QUALITY = 92;

// HEIC: o Safari abre; os outros navegadores recusam no decode e o editor avisa.
const PHOTO_EXTENSION = /\.(jpe?g|png|webp|avif|heic|heif|gif|bmp)$/i;
export function isPhotoFile(file: Pick<File, "type" | "name">): boolean {
  return file.type.startsWith("image/") || (file.type === "" && PHOTO_EXTENSION.test(file.name));
}

// createImageBitmap aplica a orientação do EXIF; sem ele (ou se recusar o formato), o <img> também aplica.
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** null quando o navegador não abre o formato. */
export async function openPhoto(file: File): Promise<Photo | null> {
  const image = await decode(file).catch(() => null);
  if (!image) return null;
  const [width, height] = "naturalWidth" in image ? [image.naturalWidth, image.naturalHeight] : [image.width, image.height];
  if (width === 0 || height === 0) return null;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
  const preview = document.createElement("canvas");
  preview.width = Math.round(width * scale);
  preview.height = Math.round(height * scale);
  const context = preview.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, preview.width, preview.height);
  return { image, width, height, preview };
}

export class PhotoExportCancelled extends Error {}

/** Faixa por faixa: recorte da foto → look → leitura dos pixels → codificador JPEG. A foto inteira nunca vai para um canvas só. */
export async function exportPhoto(photo: Photo, color: ExportColor, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<Blob> {
  const { width, height } = photo;
  const rows = Math.min(height, Math.max(16, Math.floor(TILE_PIXELS / width / 16) * 16));
  const canvas = document.createElement("canvas");
  const strip = document.createElement("canvas");
  strip.width = width;
  const stripContext = strip.getContext("2d");
  const renderer = createLutRenderer(canvas, null, () => undefined, { still: true });
  const gl = canvas.getContext("webgl2");
  if (!renderer || !gl || !stripContext) throw new Error("Este navegador não oferece WebGL2.");
  try {
    if (width > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error("A foto é larga demais para a GPU deste aparelho.");
    const plan = planPipeline(color.profile, color.lutExpectsLog);
    renderer.setLayers(color.layers);
    renderer.setNormalization({ normalizedBase: plan.normalizedBase, lookInput: plan.normalize, lut: color.normalizationLut, softHighlights: color.softHighlights });
    if (color.effects) renderer.setEffects(color.effects);
    renderer.setCompare(0, false);
    const encoder = createJpegEncoder(width, height, QUALITY);
    let pixels = new Uint8Array(0);
    for (let y = 0; y < height; y += rows) {
      if (signal.aborted) throw new PhotoExportCancelled();
      const tileHeight = Math.min(rows, height - y);
      if (strip.height !== tileHeight) strip.height = tileHeight;
      stripContext.drawImage(photo.image, 0, y, width, tileHeight, 0, 0, width, tileHeight);
      renderer.drawTile(strip, photo.preview, { x: 0, y, totalWidth: width, totalHeight: height });
      // O navegador pode reduzir o canvas sem avisar; aí os pixels não seriam os da foto.
      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== tileHeight) throw new Error("A foto é grande demais para a GPU deste aparelho.");
      if (pixels.length !== width * tileHeight * 4) pixels = new Uint8Array(width * tileHeight * 4);
      gl.readPixels(0, 0, width, tileHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels); // mesma tarefa do desenho
      // readPixels começa por baixo; o JPEG, por cima.
      for (let row = tileHeight - 1; row >= 0; row -= 1) encoder.addRows(pixels.subarray(row * width * 4, (row + 1) * width * 4), 1);
      onProgress((y + tileHeight) / height);
      await new Promise((resolve) => setTimeout(resolve)); // deixa a tela atualizar o progresso
    }
    return new Blob(encoder.finish() as BlobPart[], { type: "image/jpeg" });
  } finally {
    renderer.dispose();
  }
}
