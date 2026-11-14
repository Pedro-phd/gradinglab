// Shaders do renderizador (lut-renderer.ts): passe principal e extração do brilho, montados dos trechos GLSL.
import { NORMALIZE_APPLE_LOG_GLSL } from "./apple-log";
import { BRIGHT_MAIN, EFFECTS_GLSL, FILM_GLSL, TETRAHEDRAL_GLSL } from "./effects-glsl";
import { MAX_STACKED_LUTS } from "./lut-state";

// Triângulo que cobre a tela, sem buffers; vUv.y é invertido porque a imagem começa no topo.
export const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Comum ao passe principal e à extração do brilho: quadro, conversão do Log e ajustes.
const HEADER = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uFrame;
uniform bool uNormalizedBase;
uniform bool uNormalizedLookInput;
uniform sampler3D uNormLut;
uniform bool uUseNormLut;
uniform bool uSoftHighlights; // altas luzes suaves: conversão com ombro em vez da tabela da Apple
in vec2 vUv;
out vec4 outColor;

${NORMALIZE_APPLE_LOG_GLSL}
${TETRAHEDRAL_GLSL}
${EFFECTS_GLSL}

// A tabela da Apple cobre 0..1 nos três canais. Ela corta as luzes; com altas luzes suaves, vale o cálculo com ombro.
vec3 convertLog(vec3 c) {
  if (uSoftHighlights) return normalizeAppleLogSoft(c);
  return uUseNormLut ? sampleTetrahedral(uNormLut, clamp(c, 0.0, 1.0)) : normalizeAppleLog(c);
}
`;

export const LAYER_INDEXES = Array.from({ length: MAX_STACKED_LUTS }, (_, index) => index);
// GLSL ES 3.00 só indexa array de sampler com constante: uma função e um passo por camada, sem laço.
const LAYER_FUNCTIONS = LAYER_INDEXES.map((i) => `vec3 applyLut${i}(vec3 c) {
  return sampleTetrahedral(uLut[${i}], clamp((c - uDomainMin[${i}]) / (uDomainMax[${i}] - uDomainMin[${i}]), 0.0, 1.0));
}`).join("\n");
const LAYER_STEPS = LAYER_INDEXES.map((i) => `  if (uCount > ${i}) look = mix(look, applyLut${i}(${i === 0 ? "lookInput" : "look"}), uIntensity[${i}]);`).join("\n");

export const FRAGMENT = `${HEADER}
uniform sampler3D uLut[${MAX_STACKED_LUTS}];
uniform vec3 uDomainMin[${MAX_STACKED_LUTS}];
uniform vec3 uDomainMax[${MAX_STACKED_LUTS}];
uniform float uIntensity[${MAX_STACKED_LUTS}];
uniform int uCount;
uniform float uSplit;
uniform bool uShowOriginal;

${FILM_GLSL}

${LAYER_FUNCTIONS}

uniform vec4 uRegion; // foto em faixas: onde este pedaço está na imagem inteira (xy início, zw tamanho, 0..1)

void main() {
  vec3 raw = texture(uFrame, vUv).rgb; // quadro como veio do vídeo: é o que "Original" mostra
  // Vinheta, brilho e grão usam a posição na imagem inteira: as faixas da foto emendam sem costura.
  vec2 uv = uRegion.xy + vUv * uRegion.zw;
  // Normalização (Apple Log → Rec.709) antes da LUT; o plano decide o que é base e o que entra na LUT.
  vec3 normalized = (uNormalizedBase || uNormalizedLookInput) ? convertLog(raw) : raw;
  vec3 base = uNormalizedBase ? normalized : raw;
  vec3 lookInput = uNormalizedLookInput ? normalized : raw;
  // Ajustes, vinheta e brilho em luz linear, antes das LUTs. Sem nada ligado, o caminho é o de antes, sem ida e volta.
  vec3 graded = base;
  if (uPreActive) {
    graded = linearToRec709_3(applyGlow(adjustLinear(rec709ToLinear3(base), LUMA_709, uv), uv));
    // LUT que espera Log recebe o Log ajustado. O brilho (Rec.709) entra sem trocar de primárias: aproximação.
    lookInput = (uNormalizedBase && !uNormalizedLookInput)
      ? linearToAppleLog3(applyGlow(adjustLinear(appleLogToLinear3(raw), LUMA_2020, uv), uv))
      : graded;
  }
  // A 1ª camada mistura a base ajustada com a LUT aplicada a lookInput; as seguintes recebem o resultado anterior.
  vec3 look = graded;
${LAYER_STEPS}
  if (uGrain > 0.0) look = addGrain(look, uv);
  // Mesmo quadro nos dois lados do divisor: esquerda = base, direita = base com ajustes e pilha.
  outColor = vec4(uShowOriginal ? raw : (vUv.x < uSplit ? base : look), 1.0);
}`;

export const BRIGHT_FRAGMENT = HEADER + BRIGHT_MAIN;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader; // erro de compilação aparece no link
}

export function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("shader");
  return program;
}
