// Copia o ffmpeg.wasm de node_modules para public/ffmpeg, de onde o navegador o baixa só quando precisa converter um vídeo.
// Fica fora do git (32 MB); roda antes de `dev` e `build`.
import { cpSync, mkdirSync } from "node:fs";

const out = new URL("../public/ffmpeg/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [from, name] of [
  ["@ffmpeg/core/dist/esm/ffmpeg-core.js", "ffmpeg-core.js"],
  ["@ffmpeg/core/dist/esm/ffmpeg-core.wasm", "ffmpeg-core.wasm"],
  // Worker da biblioteca servido como arquivo: empacotado, o import dinâmico do núcleo não resolve.
  ["@ffmpeg/ffmpeg/dist/esm/worker.js", "worker.js"],
  ["@ffmpeg/ffmpeg/dist/esm/const.js", "const.js"],
  ["@ffmpeg/ffmpeg/dist/esm/errors.js", "errors.js"],
]) {
  cpSync(new URL(`../node_modules/${from}`, import.meta.url), new URL(name, out));
}
