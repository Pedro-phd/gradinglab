// WebGL2: cada quadro do <video> vira textura 2D e o shader aplica a LUT 3D. Sem readPixels, sem rede.
import { NORMALIZE_APPLE_LOG_GLSL } from "./apple-log";
import type { CubeLut } from "./cube-lut";
import { clamp01, lutTexture } from "./lut-math";

export type LutRenderer = {
  setLut(lut: CubeLut | null): void;
  setIntensity(intensity: number): void; // fração 0..1
  setCompare(split: number, showOriginal: boolean): void; // à esquerda de split (fração 0..1 da largura) vai a base
  /** normalizedBase: o "antes" é o Apple Log convertido; lookInput: a LUT também recebe a imagem convertida. */
  setNormalization(normalization: { normalizedBase: boolean; lookInput: boolean }): void;
  draw(): void; // quadro atual do vídeo; nada se ainda não há quadro
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

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uFrame;
uniform sampler3D uLut;
uniform vec3 uDomainMin;
uniform vec3 uDomainMax;
uniform float uScale;
uniform float uOffset;
uniform float uIntensity;
uniform float uSplit;
uniform bool uShowOriginal;
uniform bool uNormalizedBase;
uniform bool uNormalizedLookInput;
in vec2 vUv;
out vec4 outColor;

${NORMALIZE_APPLE_LOG_GLSL}

vec3 applyLook(vec3 base) {
  vec3 coord = clamp((base - uDomainMin) / (uDomainMax - uDomainMin), 0.0, 1.0);
  return texture(uLut, coord * uScale + uOffset).rgb;
}

void main() {
  vec3 raw = texture(uFrame, vUv).rgb; // quadro como veio do vídeo: é o que "Original" mostra
  // Normalização (Apple Log → Rec.709) antes da LUT; o plano decide o que é base e o que entra na LUT.
  vec3 normalized = (uNormalizedBase || uNormalizedLookInput) ? normalizeAppleLog(raw) : raw;
  vec3 base = uNormalizedBase ? normalized : raw;
  vec3 lookInput = uNormalizedLookInput ? normalized : raw;
  // Mesmo quadro nos dois lados do divisor: esquerda = base, direita = base com o look.
  outColor = vec4(uShowOriginal ? raw : (vUv.x < uSplit ? base : mix(base, applyLook(lookInput), uIntensity)), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader; // erro de compilação aparece no link
}

// Num contexto perdido getExtension devolve null; guardar a extensão permite reaproveitar o canvas (Strict Mode).
const loseContext = new WeakMap<HTMLCanvasElement, WEBGL_lose_context | null>();

/** Devolve null quando o navegador não oferece WebGL2 ou o shader não compila. */
export function createLutRenderer(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  onUnsupported: () => void, // falha ao recriar os recursos depois de perder o contexto
): LutRenderer | null {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  // Sem LUT: 1 texel, só para o sampler ter o que ler (com intensidade 0 ele não aparece).
  const noLut: ReturnType<typeof lutTexture> = { size: 1, data: new Float32Array(3), domainMin: [0, 0, 0], domainMax: [1, 1, 1], scale: 1, offset: 0 };
  let table = noLut;
  let intensity = 0;
  let split = 0; // 0 = só o resultado
  let showOriginal = false;
  let normalization = { normalizedBase: false, lookInput: false };
  let lost = context.isContextLost(); // canvas reaproveitado depois de um dispose
  const lose = loseContext.get(canvas) ?? gl.getExtension("WEBGL_lose_context");
  loseContext.set(canvas, lose);
  let program: WebGLProgram | null = null;
  let frameTexture: WebGLTexture | null = null;
  let lutTextureHandle: WebGLTexture | null = null;
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
  function uploadLut() {
    const { size, data } = table;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, lutTextureHandle);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
  }

  // Cria todos os recursos de GPU; também é o que roda depois de uma perda de contexto.
  function init() {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("shader");
    for (const name of ["uFrame", "uLut", "uDomainMin", "uDomainMax", "uScale", "uOffset", "uIntensity", "uSplit", "uShowOriginal", "uNormalizedBase", "uNormalizedLookInput"]) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    frameTexture = createTexture(gl.TEXTURE0, gl.TEXTURE_2D);
    lutTextureHandle = createTexture(gl.TEXTURE1, gl.TEXTURE_3D);
    uploadLut();
  }

  function draw() {
    // HAVE_CURRENT_DATA (2): já existe um quadro para enviar.
    if (lost || !program || video.readyState < 2 || video.videoWidth === 0) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(uniforms.uFrame, 0);
    gl.uniform1i(uniforms.uLut, 1);
    gl.uniform3fv(uniforms.uDomainMin, table.domainMin);
    gl.uniform3fv(uniforms.uDomainMax, table.domainMax);
    gl.uniform1f(uniforms.uScale, table.scale);
    gl.uniform1f(uniforms.uOffset, table.offset);
    gl.uniform1f(uniforms.uIntensity, intensity);
    gl.uniform1f(uniforms.uSplit, split);
    gl.uniform1i(uniforms.uShowOriginal, showOriginal ? 1 : 0);
    gl.uniform1i(uniforms.uNormalizedBase, normalization.normalizedBase ? 1 : 0);
    gl.uniform1i(uniforms.uNormalizedLookInput, normalization.lookInput ? 1 : 0);
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
    setLut(next) {
      table = next ? lutTexture(next) : noLut;
      if (!lost) uploadLut();
    },
    setIntensity: (next) => void (intensity = clamp01(next)),
    setCompare(nextSplit, nextShowOriginal) {
      split = clamp01(nextSplit);
      showOriginal = nextShowOriginal;
    },
    setNormalization: (next) => void (normalization = next),
    draw,
    dispose() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (lost) return;
      gl.deleteProgram(program);
      gl.deleteTexture(frameTexture);
      gl.deleteTexture(lutTextureHandle);
      lose?.loseContext(); // devolve a GPU sem esperar o coletor de lixo
    },
  };
}
