// WebGL2: cada quadro (do <video> na prévia, decodificado na exportação) vira textura 2D e o shader aplica a LUT 3D.
// Sem readPixels, sem rede. A exportação usa este mesmo renderizador e este mesmo shader.
import type { CubeLut } from "./cube-lut";
import { effectUniforms, NEUTRAL_EFFECTS, type EffectUniforms, type Effects } from "./effects";
import { createGlowPass, type GlowPass } from "./glow-pass";
import { clamp01, lutTexture } from "./lut-math";
import { BRIGHT_FRAGMENT, FRAGMENT, LAYER_INDEXES, link, VERTEX } from "./lut-shaders";
import { MAX_STACKED_LUTS, type LutLayer } from "./lut-state";

export type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
/** Quadro decodificado da exportação (ou o canvas que o Mediabunny entrega depois de girar). */
export type FrameSource = VideoFrame | RenderCanvas;

/** lut: tabela Apple Log → Rec.709 (a da Apple). Sem ela (ainda carregando ou falhou), vale o cálculo do shader. */
/** softHighlights: comprime as luzes acima de 1 em vez de cortar (substitui a tabela da Apple). */
export type Normalization = { normalizedBase: boolean; lookInput: boolean; lut?: CubeLut | null; softHighlights?: boolean };

/** Posição do pedaço (px) na imagem inteira. */
export type TileRegion = { x: number; y: number; totalWidth: number; totalHeight: number };

export type LutRenderer = {
  /** Pilha na ordem de aplicação; cada camada mistura o resultado anterior com a LUT pela própria intensidade. */
  setLayers(layers: LutLayer[]): void;
  setCompare(split: number, showOriginal: boolean): void; // à esquerda de split (fração 0..1 da largura) vai a base
  /** normalizedBase: o "antes" é o Apple Log convertido; lookInput: a LUT também recebe a imagem convertida. */
  setNormalization(normalization: Normalization): void;
  /** Ajustes e efeitos de filme do "depois"; o "antes" do divisor fica sem eles. */
  setEffects(effects: Effects): void;
  draw(): void; // quadro atual do vídeo; nada se ainda não há quadro
  drawFrame(frame: FrameSource): void; // exportação: o canvas passa a ter o tamanho do quadro
  /** Foto em faixas: desenha um pedaço da imagem inteira; o brilho sai de `glow` (a imagem inteira reduzida). */
  drawTile(tile: FrameSource, glow: FrameSource, region: TileRegion): void;
  dispose(): void;
};

// Num contexto perdido getExtension devolve null; guardar a extensão permite reaproveitar o canvas (Strict Mode).
const loseContext = new WeakMap<RenderCanvas, WEBGL_lose_context | null>();

/** Devolve null quando o navegador não oferece WebGL2 ou o shader não compila. Sem `video`, só drawFrame desenha. */
export function createLutRenderer(
  canvas: RenderCanvas,
  video: HTMLVideoElement | null,
  onUnsupported: () => void, // falha ao recriar os recursos depois de perder o contexto
  options: { still?: boolean } = {}, // foto: grão parado, igual na prévia e no arquivo
): LutRenderer | null {
  // Cast: com a união HTMLCanvasElement | OffscreenCanvas, algumas versões do TypeScript resolvem getContext para o tipo genérico.
  const context = canvas.getContext("webgl2", { alpha: false, antialias: false }) as WebGL2RenderingContext | null;
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  // Sem LUT: 1 texel, só para o sampler ter o que ler (com intensidade 0 ele não aparece).
  const noLut: ReturnType<typeof lutTexture> = { size: 1, data: new Float32Array(3), domainMin: [0, 0, 0], domainMax: [1, 1, 1], scale: 1, offset: 0 };
  let layers: LutLayer[] = [];
  const uploaded: (LutLayer["lut"] | null)[] = new Array(MAX_STACKED_LUTS).fill(null); // o que já está em cada textura
  let split = 0; // 0 = só o resultado
  let showOriginal = false;
  let normalization: Normalization = { normalizedBase: false, lookInput: false };
  let effects: EffectUniforms = effectUniforms(NEUTRAL_EFFECTS);
  let frameCount = 0; // semente do grão: muda a cada quadro, igual na prévia e na exportação
  let uploadedNorm: CubeLut | null = null;
  let normTexture: WebGLTexture | null = null;
  const NORM_UNIT = MAX_STACKED_LUTS + 1; // depois do quadro (0) e das camadas (1..MAX)
  const HALATION_UNIT = NORM_UNIT + 1;
  const BLOOM_UNIT = NORM_UNIT + 2;
  const MIST_UNIT = NORM_UNIT + 3; // 12: dentro das 16 unidades que o WebGL2 garante
  let lost = context.isContextLost(); // canvas reaproveitado depois de um dispose
  const lose = loseContext.get(canvas) ?? gl.getExtension("WEBGL_lose_context");
  loseContext.set(canvas, lose);
  let program: WebGLProgram | null = null;
  let glowPass: GlowPass | null = null;
  let frameTexture: WebGLTexture | null = null;
  let lutTextures: (WebGLTexture | null)[] = [];
  const locations = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program!, name));
    return locations.get(name)!;
  };

  function createTexture(unit: number, target: number) {
    const texture = gl.createTexture();
    gl.activeTexture(unit);
    gl.bindTexture(target, texture);
    for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(target, wrap, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  // RGB16F: a LUT fica em ponto flutuante em qualquer navegador com WebGL2, sem caminho de 8 bits.
  // A interpolação é tetraédrica, feita no shader com texelFetch (o filtro da textura não entra).
  // Só reenvia a textura quando a LUT daquela posição mudou: mexer na intensidade não custa upload.
  function uploadLuts(force = false) {
    LAYER_INDEXES.forEach((i) => {
      const lut = layers[i]?.lut ?? null;
      if (!force && uploaded[i] === lut) return;
      const { size, data } = lut ? lutTexture(lut) : noLut;
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_3D, lutTextures[i]!);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
      uploaded[i] = lut;
    });
    const norm = normalization.lut ?? null;
    if (force || uploadedNorm !== norm) {
      const { size, data } = norm ? lutTexture(norm) : noLut;
      gl.activeTexture(gl.TEXTURE0 + NORM_UNIT);
      gl.bindTexture(gl.TEXTURE_3D, normTexture);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
      uploadedNorm = norm;
    }
  }

  // Cria todos os recursos de GPU; também é o que roda depois de uma perda de contexto.
  function init() {
    locations.clear();
    program = link(gl, VERTEX, FRAGMENT);
    glowPass = createGlowPass(gl, (vertex, fragment) => link(gl, vertex, fragment), BRIGHT_FRAGMENT, HALATION_UNIT);
    frameTexture = createTexture(gl.TEXTURE0, gl.TEXTURE_2D);
    lutTextures = LAYER_INDEXES.map((i) => createTexture(gl.TEXTURE1 + i, gl.TEXTURE_3D));
    normTexture = createTexture(gl.TEXTURE0 + NORM_UNIT, gl.TEXTURE_3D);
    uploadLuts(true);
  }

  function draw() {
    // HAVE_CURRENT_DATA (2): já existe um quadro para enviar.
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;
    render(video, video.videoWidth, video.videoHeight);
  }

  const sizeOf = (frame: FrameSource) => ("displayWidth" in frame ? [frame.displayWidth, frame.displayHeight] : [frame.width, frame.height]) as [number, number];

  function drawFrame(frame: FrameSource) {
    render(frame, ...sizeOf(frame));
  }

  function drawTile(tile: FrameSource, glow: FrameSource, region: TileRegion) {
    render(tile, ...sizeOf(tile), { glow, region });
  }

  function upload(source: TexImageSource | VideoFrame) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // Sem conversão do navegador: ela mudaria as primárias antes da matriz do shader.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    // RGBA16F: a curva Log roda sobre ponto flutuante, não sobre 8 bits.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, source);
  }

  // Quadro, conversão e ajustes: valem para o passe principal e para a extração do brilho.
  function setShared(locate: (name: string) => WebGLUniformLocation | null, width: number, height: number) {
    gl.uniform1i(locate("uFrame"), 0);
    gl.uniform1i(locate("uNormLut"), NORM_UNIT);
    gl.uniform1i(locate("uUseNormLut"), normalization.lut ? 1 : 0);
    gl.uniform1i(locate("uSoftHighlights"), normalization.softHighlights ? 1 : 0);
    gl.uniform1i(locate("uNormalizedBase"), normalization.normalizedBase ? 1 : 0);
    gl.uniform1i(locate("uNormalizedLookInput"), normalization.lookInput ? 1 : 0);
    gl.uniform1i(locate("uPreActive"), effects.adjust || effects.vignette > 0 || effects.halation || effects.bloom || effects.mist ? 1 : 0);
    gl.uniform1i(locate("uAdjust"), effects.adjust ? 1 : 0);
    gl.uniform1f(locate("uExposure"), effects.exposure);
    gl.uniform3fv(locate("uWhiteBalance"), effects.whiteBalance);
    gl.uniform1f(locate("uContrast"), effects.contrast);
    gl.uniform1f(locate("uSaturation"), effects.saturation);
    gl.uniform1f(locate("uVignette"), effects.vignette);
    gl.uniform1f(locate("uVignetteSoftness"), effects.vignetteSoftness);
    gl.uniform1f(locate("uAspect"), width / height);
  }

  function render(source: TexImageSource | VideoFrame, width: number, height: number, tile?: { glow: FrameSource; region: TileRegion }) {
    if (lost || !program || !glowPass) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    frameCount += 1;
    // Vinheta, grão e brilho seguem a imagem inteira; num pedaço, ela é maior que o canvas.
    const [totalWidth, totalHeight] = tile ? [tile.region.totalWidth, tile.region.totalHeight] : [width, height];
    const glowing = effects.halation || effects.bloom || effects.mist;
    // Pedaço: o brilho é calculado na imagem inteira reduzida (o desfoque passa das bordas do pedaço).
    const [glowWidth, glowHeight] = tile ? sizeOf(tile.glow) : [width, height];
    upload(tile && glowing ? tile.glow : source);

    const pass = glowPass;
    const shared = (locate: (name: string) => WebGLUniformLocation | null) => setShared(locate, glowWidth, glowHeight);
    const halation = effects.halation && pass.run(effects.halation, 0, true, glowWidth, glowHeight, shared);
    const bloom = effects.bloom && pass.run(effects.bloom, 1, false, glowWidth, glowHeight, shared);
    const mist = effects.mist && pass.run(effects.mist, 2, false, glowWidth, glowHeight, shared);
    if (tile && glowing) upload(source);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    setShared(at, totalWidth, totalHeight);
    const region = tile?.region;
    gl.uniform4f(at("uRegion"), region ? region.x / totalWidth : 0, region ? region.y / totalHeight : 0, width / totalWidth, height / totalHeight);
    gl.activeTexture(gl.TEXTURE0 + HALATION_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, halation || null);
    gl.activeTexture(gl.TEXTURE0 + BLOOM_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, bloom || null);
    gl.activeTexture(gl.TEXTURE0 + MIST_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, mist || null);
    gl.uniform1i(at("uMistTex"), MIST_UNIT);
    gl.uniform1f(at("uMist"), effects.mist?.amount ?? 0);
    gl.uniform1i(at("uHalationTex"), HALATION_UNIT);
    gl.uniform1i(at("uBloomTex"), BLOOM_UNIT);
    gl.uniform1f(at("uHalation"), effects.halation?.amount ?? 0);
    gl.uniform1f(at("uBloom"), effects.bloom?.amount ?? 0);
    gl.uniform1i(at("uGlowPacked"), pass.packed ? 1 : 0);
    gl.uniform1f(at("uGrain"), effects.grain);
    gl.uniform1f(at("uGrainSize"), effects.grainSize * (Math.min(totalWidth, totalHeight) / 1080));
    gl.uniform1f(at("uSeed"), options.still ? 0 : (frameCount * 37.17) % 1000);
    gl.uniform2f(at("uResolution"), totalWidth, totalHeight);
    const tables = LAYER_INDEXES.map((i) => (layers[i] ? lutTexture(layers[i].lut) : noLut));
    gl.uniform1iv(at("uLut"), LAYER_INDEXES.map((i) => i + 1));
    gl.uniform3fv(at("uDomainMin"), tables.flatMap((t) => t.domainMin));
    gl.uniform3fv(at("uDomainMax"), tables.flatMap((t) => t.domainMax));
    gl.uniform1fv(at("uIntensity"), LAYER_INDEXES.map((i) => layers[i]?.intensity ?? 0));
    gl.uniform1i(at("uCount"), layers.length);
    gl.uniform1f(at("uSplit"), split);
    gl.uniform1i(at("uShowOriginal"), showOriginal ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function onContextLost(event: Event) {
    event.preventDefault(); // sem isso o navegador não tenta restaurar
    lost = true;
  }
  function onContextRestored() {
    lost = false;
    try {
      init();
      draw();
    } catch {
      program = null; // draw() passa a não fazer nada
      onUnsupported();
    }
  }

  // Canvas reaproveitado: o navegador só aceita restaurar depois do evento de perda (cancelado em onContextLost); init() roda em onContextRestored.
  if (lost) setTimeout(() => lose?.restoreContext());
  else try { init(); } catch { return null; }
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  return {
    setLayers(next) {
      layers = next.slice(0, MAX_STACKED_LUTS).map((layer) => ({ lut: layer.lut, intensity: clamp01(layer.intensity) }));
      if (!lost) uploadLuts();
    },
    setCompare(nextSplit, nextShowOriginal) {
      split = clamp01(nextSplit);
      showOriginal = nextShowOriginal;
    },
    setNormalization(next) {
      normalization = next;
      if (!lost) uploadLuts();
    },
    setEffects(next) {
      effects = effectUniforms(next);
    },
    draw,
    drawFrame,
    drawTile,
    dispose() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (lost) return;
      gl.deleteProgram(program);
      glowPass?.dispose();
      gl.deleteTexture(frameTexture);
      lutTextures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteTexture(normTexture);
      lose?.loseContext(); // devolve a GPU sem esperar o coletor de lixo
    },
  };
}
