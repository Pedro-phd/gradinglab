// WebGL2: cada quadro (do <video> na prévia, decodificado na exportação) vira textura 2D e o shader aplica a LUT 3D.
// Sem readPixels, sem rede. A exportação usa este mesmo renderizador e este mesmo shader.
import { NORMALIZE_APPLE_LOG_GLSL } from "./apple-log";
import type { CubeLut } from "./cube-lut";
import { clamp01, lutTexture } from "./lut-math";
import { MAX_STACKED_LUTS, type LutLayer } from "./lut-state";

export type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
/** Quadro decodificado da exportação (ou o canvas que o Mediabunny entrega depois de girar). */
export type FrameSource = VideoFrame | RenderCanvas;

/** lut: tabela Apple Log → Rec.709 (a da Apple). Sem ela (ainda carregando ou falhou), vale o cálculo do shader. */
export type Normalization = { normalizedBase: boolean; lookInput: boolean; lut?: CubeLut | null };

export type LutRenderer = {
  /** Pilha na ordem de aplicação; cada camada mistura o resultado anterior com a LUT pela própria intensidade. */
  setLayers(layers: LutLayer[]): void;
  setCompare(split: number, showOriginal: boolean): void; // à esquerda de split (fração 0..1 da largura) vai a base
  /** normalizedBase: o "antes" é o Apple Log convertido; lookInput: a LUT também recebe a imagem convertida. */
  setNormalization(normalization: Normalization): void;
  draw(): void; // quadro atual do vídeo; nada se ainda não há quadro
  drawFrame(frame: FrameSource): void; // exportação: o canvas passa a ter o tamanho do quadro
  dispose(): void;
};

// Triângulo que cobre a tela, sem buffers; vUv.y é invertido porque a imagem começa no topo.
const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const LAYER_INDEXES = Array.from({ length: MAX_STACKED_LUTS }, (_, index) => index);
// GLSL ES 3.00 só indexa array de sampler com constante: uma função e um passo por camada, sem laço.
const LAYER_FUNCTIONS = LAYER_INDEXES.map((i) => `vec3 applyLut${i}(vec3 c) {
  vec3 coord = clamp((c - uDomainMin[${i}]) / (uDomainMax[${i}] - uDomainMin[${i}]), 0.0, 1.0);
  return texture(uLut[${i}], coord * uScale[${i}] + uOffset[${i}]).rgb;
}`).join("\n");
const LAYER_STEPS = LAYER_INDEXES.map((i) => `  if (uCount > ${i}) look = mix(look, applyLut${i}(${i === 0 ? "lookInput" : "look"}), uIntensity[${i}]);`).join("\n");

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uFrame;
uniform sampler3D uLut[${MAX_STACKED_LUTS}];
uniform vec3 uDomainMin[${MAX_STACKED_LUTS}];
uniform vec3 uDomainMax[${MAX_STACKED_LUTS}];
uniform float uScale[${MAX_STACKED_LUTS}];
uniform float uOffset[${MAX_STACKED_LUTS}];
uniform float uIntensity[${MAX_STACKED_LUTS}];
uniform int uCount;
uniform float uSplit;
uniform bool uShowOriginal;
uniform bool uNormalizedBase;
uniform bool uNormalizedLookInput;
uniform sampler3D uNormLut;
uniform bool uUseNormLut;
uniform float uNormScale;
uniform float uNormOffset;
in vec2 vUv;
out vec4 outColor;

${NORMALIZE_APPLE_LOG_GLSL}

${LAYER_FUNCTIONS}

// A tabela da Apple cobre 0..1 nos três canais.
vec3 convertLog(vec3 c) {
  return uUseNormLut ? texture(uNormLut, clamp(c, 0.0, 1.0) * uNormScale + uNormOffset).rgb : normalizeAppleLog(c);
}

void main() {
  vec3 raw = texture(uFrame, vUv).rgb; // quadro como veio do vídeo: é o que "Original" mostra
  // Normalização (Apple Log → Rec.709) antes da LUT; o plano decide o que é base e o que entra na LUT.
  vec3 normalized = (uNormalizedBase || uNormalizedLookInput) ? convertLog(raw) : raw;
  vec3 base = uNormalizedBase ? normalized : raw;
  vec3 lookInput = uNormalizedLookInput ? normalized : raw;
  // A 1ª camada mistura a base com a LUT aplicada a lookInput; as seguintes recebem o resultado anterior.
  vec3 look = base;
${LAYER_STEPS}
  // Mesmo quadro nos dois lados do divisor: esquerda = base, direita = base com a pilha.
  outColor = vec4(uShowOriginal ? raw : (vUv.x < uSplit ? base : look), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader; // erro de compilação aparece no link
}

// Num contexto perdido getExtension devolve null; guardar a extensão permite reaproveitar o canvas (Strict Mode).
const loseContext = new WeakMap<RenderCanvas, WEBGL_lose_context | null>();

/** Devolve null quando o navegador não oferece WebGL2 ou o shader não compila. Sem `video`, só drawFrame desenha. */
export function createLutRenderer(
  canvas: RenderCanvas,
  video: HTMLVideoElement | null,
  onUnsupported: () => void, // falha ao recriar os recursos depois de perder o contexto
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
  let uploadedNorm: CubeLut | null = null;
  let normTexture: WebGLTexture | null = null;
  const NORM_UNIT = MAX_STACKED_LUTS + 1; // depois do quadro (0) e das camadas (1..MAX)
  let lost = context.isContextLost(); // canvas reaproveitado depois de um dispose
  const lose = loseContext.get(canvas) ?? gl.getExtension("WEBGL_lose_context");
  loseContext.set(canvas, lose);
  let program: WebGLProgram | null = null;
  let frameTexture: WebGLTexture | null = null;
  let lutTextures: (WebGLTexture | null)[] = [];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};

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

  // RGB16F: no WebGL2 ele aceita filtro linear sem extensão, então a LUT fica em ponto flutuante
  // em qualquer navegador com WebGL2 e não há caminho de 8 bits. A interpolação é trilinear
  // (filtro linear 3D), não tetraédrica.
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
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("shader");
    for (const name of ["uFrame", "uLut", "uDomainMin", "uDomainMax", "uScale", "uOffset", "uIntensity", "uCount", "uSplit", "uShowOriginal", "uNormalizedBase", "uNormalizedLookInput", "uNormLut", "uUseNormLut", "uNormScale", "uNormOffset"]) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
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

  function drawFrame(frame: FrameSource) {
    const [width, height] = "displayWidth" in frame ? [frame.displayWidth, frame.displayHeight] : [frame.width, frame.height];
    render(frame, width, height);
  }

  function render(source: TexImageSource | VideoFrame, width: number, height: number) {
    if (lost || !program) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // Sem conversão do navegador: ela mudaria as primárias antes da matriz do shader.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    // RGBA16F: a curva Log roda sobre ponto flutuante, não sobre 8 bits.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, source);
    gl.uniform1i(uniforms.uFrame, 0);
    const tables = LAYER_INDEXES.map((i) => (layers[i] ? lutTexture(layers[i].lut) : noLut));
    gl.uniform1iv(uniforms.uLut, LAYER_INDEXES.map((i) => i + 1));
    gl.uniform3fv(uniforms.uDomainMin, tables.flatMap((t) => t.domainMin));
    gl.uniform3fv(uniforms.uDomainMax, tables.flatMap((t) => t.domainMax));
    gl.uniform1fv(uniforms.uScale, tables.map((t) => t.scale));
    gl.uniform1fv(uniforms.uOffset, tables.map((t) => t.offset));
    gl.uniform1fv(uniforms.uIntensity, LAYER_INDEXES.map((i) => layers[i]?.intensity ?? 0));
    gl.uniform1i(uniforms.uCount, layers.length);
    gl.uniform1f(uniforms.uSplit, split);
    gl.uniform1i(uniforms.uShowOriginal, showOriginal ? 1 : 0);
    gl.uniform1i(uniforms.uNormalizedBase, normalization.normalizedBase ? 1 : 0);
    gl.uniform1i(uniforms.uNormalizedLookInput, normalization.lookInput ? 1 : 0);
    const norm = normalization.lut ? lutTexture(normalization.lut) : null;
    gl.uniform1i(uniforms.uNormLut, NORM_UNIT);
    gl.uniform1i(uniforms.uUseNormLut, norm ? 1 : 0);
    gl.uniform1f(uniforms.uNormScale, norm?.scale ?? 1);
    gl.uniform1f(uniforms.uNormOffset, norm?.offset ?? 0);
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
    draw,
    drawFrame,
    dispose() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (lost) return;
      gl.deleteProgram(program);
      gl.deleteTexture(frameTexture);
      lutTextures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteTexture(normTexture);
      lose?.loseContext(); // devolve a GPU sem esperar o coletor de lixo
    },
  };
}
