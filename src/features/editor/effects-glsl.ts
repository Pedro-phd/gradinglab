// Trechos GLSL dos ajustes, do brilho (halation/bloom), do grão e da leitura tetraédrica da LUT.
// lut-renderer.ts monta os shaders; os valores vêm de effectUniforms (effects.ts).
// Dependem das funções de NORMALIZE_APPLE_LOG_GLSL (apple-log.ts), incluídas antes.

/** Passes em textura (brilho): sem inverter y, a textura de destino fica na orientação do quadro. */
export const PASS_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Tetraédrica, como a especificação Adobe CUBE recomenda: 4 vértices do cubo, escolhidos pela ordem de r, g e b.
// coord já normalizada para 0..1 pelo domínio da LUT.
export const TETRAHEDRAL_GLSL = `
vec3 sampleTetrahedral(sampler3D lut, vec3 coord) {
  int size = textureSize(lut, 0).x;
  if (size < 2) return texelFetch(lut, ivec3(0), 0).rgb; // textura vazia (sem LUT naquela posição)
  float n = float(size - 1);
  vec3 scaled = coord * n;
  vec3 cell = min(floor(scaled), vec3(n - 1.0));
  vec3 f = scaled - cell;
  ivec3 i = ivec3(cell);
  vec3 c000 = texelFetch(lut, i, 0).rgb;
  vec3 c111 = texelFetch(lut, i + ivec3(1, 1, 1), 0).rgb;
  if (f.r >= f.g) {
    if (f.g >= f.b) {
      vec3 c100 = texelFetch(lut, i + ivec3(1, 0, 0), 0).rgb;
      vec3 c110 = texelFetch(lut, i + ivec3(1, 1, 0), 0).rgb;
      return c000 + f.r * (c100 - c000) + f.g * (c110 - c100) + f.b * (c111 - c110);
    }
    if (f.r >= f.b) {
      vec3 c100 = texelFetch(lut, i + ivec3(1, 0, 0), 0).rgb;
      vec3 c101 = texelFetch(lut, i + ivec3(1, 0, 1), 0).rgb;
      return c000 + f.r * (c100 - c000) + f.b * (c101 - c100) + f.g * (c111 - c101);
    }
    vec3 c001 = texelFetch(lut, i + ivec3(0, 0, 1), 0).rgb;
    vec3 c101 = texelFetch(lut, i + ivec3(1, 0, 1), 0).rgb;
    return c000 + f.b * (c001 - c000) + f.r * (c101 - c001) + f.g * (c111 - c101);
  }
  if (f.b >= f.g) {
    vec3 c001 = texelFetch(lut, i + ivec3(0, 0, 1), 0).rgb;
    vec3 c011 = texelFetch(lut, i + ivec3(0, 1, 1), 0).rgb;
    return c000 + f.b * (c001 - c000) + f.g * (c011 - c001) + f.r * (c111 - c011);
  }
  if (f.b >= f.r) {
    vec3 c010 = texelFetch(lut, i + ivec3(0, 1, 0), 0).rgb;
    vec3 c011 = texelFetch(lut, i + ivec3(0, 1, 1), 0).rgb;
    return c000 + f.g * (c010 - c000) + f.b * (c011 - c010) + f.r * (c111 - c011);
  }
  vec3 c010 = texelFetch(lut, i + ivec3(0, 1, 0), 0).rgb;
  vec3 c110 = texelFetch(lut, i + ivec3(1, 1, 0), 0).rgb;
  return c000 + f.g * (c010 - c000) + f.r * (c110 - c010) + f.b * (c111 - c110);
}`;

// Ajustes e vinheta em luz linear, antes das LUTs: a LUT recebe a imagem já exposta e com o branco certo.
export const EFFECTS_GLSL = `
uniform bool uPreActive; // algum ajuste, vinheta, brilho ou difusão ligado
uniform bool uAdjust;
uniform float uExposure; // EV
uniform vec3 uWhiteBalance;
uniform float uContrast;
uniform float uSaturation;
uniform vec4 uTone; // ponto preto, sombras, realces, luminosidade (-1..1), com o Brilho já somado
uniform float uVibrance;
uniform float uVignette;
uniform float uVignetteSoftness;
uniform float uAspect; // largura/altura do quadro

const vec3 LUMA_709 = vec3(0.2126, 0.7152, 0.0722);
const vec3 LUMA_2020 = vec3(0.2627, 0.6780, 0.0593);

vec3 rec709ToLinear3(vec3 c) { return vec3(rec709ToLinear(c.r), rec709ToLinear(c.g), rec709ToLinear(c.b)); }
vec3 linearToRec709_3(vec3 l) { l = clamp(l, 0.0, 1.0); return vec3(linearToRec709(l.r), linearToRec709(l.g), linearToRec709(l.b)); }
vec3 appleLogToLinear3(vec3 p) { return vec3(appleLogToLinear(p.r), appleLogToLinear(p.g), appleLogToLinear(p.b)); }
vec3 linearToAppleLog3(vec3 l) { return vec3(linearToAppleLog(l.r), linearToAppleLog(l.g), linearToAppleLog(l.b)); }

// Queda de luz radial: 0 no centro, 1 no canto, com a proporção do quadro.
float vignetteAt(vec2 uv) {
  vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
  float r = length(d) / length(vec2(uAspect, 1.0) * 0.5);
  return 1.0 - uVignette * smoothstep((1.0 - uVignetteSoftness) * 0.9, 1.05, r);
}

// Curva de tons sobre a luminância em gama ~2,2 (perto de como a gente percebe), não na luz linear.
float toneCurve(float p) {
  float k = 0.1 * uTone.x;
  p = max((p - k) / (1.0 - k), 0.0); // positivo afunda os pretos; negativo os levanta
  p += uTone.y * 0.9 * p * (1.0 - smoothstep(0.0, 0.7, p));
  p += uTone.z * 0.3 * smoothstep(0.4, 1.0, p) * min(p, 2.0); // acima de 1 (Log) também desce
  return pow(max(p, 0.0), exp2(-0.6 * uTone.w)); // luminosidade: gama nos meios-tons, preto e branco fixos
}

// luma: coeficientes das primárias em que a luz está (Rec.709, ou Rec.2020 no Log que vai direto à LUT).
vec3 adjustLinear(vec3 lin, vec3 luma, vec2 uv) {
  if (uAdjust) {
    lin *= exp2(uExposure) * uWhiteBalance;
    // Tons pela luminância: a razão mantém o matiz de cada pixel.
    float y = dot(lin, luma);
    float toned = pow(toneCurve(pow(max(y, 0.0), 1.0 / 2.2)), 2.2);
    lin = y > 1e-5 ? lin * (toned / y) : vec3(toned);
    lin = 0.18 * pow(max(lin, vec3(1e-6)) / 0.18, vec3(uContrast)); // contraste em torno do cinza médio
    // Vividez: positiva satura mais o que tem pouca cor (protege o que já é forte); negativa tira por igual.
    float hi = max(lin.r, max(lin.g, lin.b));
    float chroma = hi > 1e-5 ? (hi - min(lin.r, min(lin.g, lin.b))) / hi : 0.0;
    float vibrance = 1.0 + uVibrance * (uVibrance > 0.0 ? 1.0 - chroma : 1.0);
    lin = max(mix(vec3(dot(lin, luma)), lin, uSaturation * vibrance), 0.0);
  }
  if (uVignette > 0.0) lin *= vignetteAt(uv);
  return lin;
}`;

/** Extração das luzes acima do limiar, em 1/4 da resolução. */
export const BRIGHT_MAIN = `
uniform float uThreshold;
uniform bool uLumaOnly; // halation: só a intensidade; a cor vem do tom fixo
uniform bool uPack; // sem alvo em ponto flutuante: guarda x/(1+x) em 8 bits
void main() {
  vec3 raw = texture(uFrame, vUv).rgb;
  vec3 lin = adjustLinear(rec709ToLinear3(uNormalizedBase ? convertLog(raw) : raw), LUMA_709, vUv);
  float knee = uThreshold * 0.5;
  float peak = max(lin.r, max(lin.g, lin.b));
  float soft = clamp(peak - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  // Dividido pela faixa acima do limiar: um branco puro rende perto de 1 com qualquer limiar.
  vec3 light = lin * (max(soft, peak - uThreshold) / max(peak, 1e-5)) / (1.05 - uThreshold);
  if (uLumaOnly) light = vec3(dot(light, LUMA_709));
  outColor = vec4(uPack ? light / (1.0 + light) : light, 1.0);
}`;

export const BLUR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep; // distância entre amostras, em coordenadas de textura
uniform bool uPack;
in vec2 vUv;
out vec4 outColor;
const float W[5] = float[5](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);
vec3 unpackLight(vec3 v) { return uPack ? v / (1.0 - min(v, vec3(0.999))) : v; }
void main() {
  vec3 sum = unpackLight(texture(uSource, vUv).rgb) * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uStep * float(i);
    sum += (unpackLight(texture(uSource, vUv + offset).rgb) + unpackLight(texture(uSource, vUv - offset).rgb)) * W[i];
  }
  outColor = vec4(uPack ? sum / (1.0 + sum) : sum, 1.0);
}`;

// Brilho em luz linear antes das LUTs (o look também colore o brilho) e grão depois delas.
export const FILM_GLSL = `
uniform sampler2D uHalationTex;
uniform sampler2D uBloomTex;
uniform sampler2D uMistTex;
uniform sampler2D uDefinitionTex; // luminância borrada, para o contraste local
uniform float uDefinition; // 0 desliga
uniform float uSharpness; // 0 desliga
uniform vec2 uTexel; // distância entre as amostras da nitidez, em coordenadas do quadro
uniform float uHalation; // 0 desliga
uniform float uBloom;
uniform float uMist;
uniform bool uGlowPacked;
uniform float uGrain; // 0 desliga
uniform float uGrainSize; // em pixels do quadro
uniform float uSeed; // muda a cada quadro
uniform vec2 uResolution;

vec3 unpackGlow(vec3 v) { return uGlowPacked ? v / (1.0 - min(v, vec3(0.999))) : v; }
// lin: luz linear já ajustada. Bloom e halation somam luz; a difusão (filtro Pro-Mist) tira um pouco do
// contraste e espalha as luzes, o que também levanta levemente os pretos.
vec3 applyGlow(vec3 lin, vec2 uv) {
  // Definição: afasta cada pixel da média da vizinhança (em razão, para não mudar a cor). Limitada para não fazer halo forte.
  if (uDefinition > 0.0) {
    float y = dot(lin, LUMA_709);
    float around = dot(unpackGlow(texture(uDefinitionTex, uv).rgb), LUMA_709) * 1.05; // a extração divide por 1,05 com limiar 0
    lin *= clamp(pow((y + 0.02) / (around + 0.02), 0.8 * uDefinition), 0.6, 1.6);
  }
  if (uMist > 0.0) lin = lin * (1.0 - 0.25 * uMist) + 0.9 * uMist * unpackGlow(texture(uMistTex, uv).rgb);
  if (uBloom > 0.0) lin += uBloom * unpackGlow(texture(uBloomTex, uv).rgb);
  if (uHalation > 0.0) lin += uHalation * vec3(1.0, 0.28, 0.06) * unpackGlow(texture(uHalationTex, uv).rgb);
  return lin;
}

// Nitidez (máscara de nitidez): diferença entre o pixel e a média dos 4 vizinhos no quadro original, só na luminância.
float sharpenDetail(vec2 uv) {
  vec3 around = texture(uFrame, uv + vec2(uTexel.x, 0.0)).rgb + texture(uFrame, uv - vec2(uTexel.x, 0.0)).rgb
    + texture(uFrame, uv + vec2(0.0, uTexel.y)).rgb + texture(uFrame, uv - vec2(0.0, uTexel.y)).rgb;
  float detail = dot(texture(uFrame, uv).rgb - 0.25 * around, LUMA_709);
  return clamp(detail, -0.06, 0.06) * uSharpness * 2.5; // limite: borda forte não vira contorno branco
}

float grainHash(vec2 q) { q = fract(q * vec2(443.897, 441.423)); q += dot(q, q.yx + 19.19); return fract((q.x + q.y) * q.x); }
float grainNoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(grainHash(i), grainHash(i + vec2(1.0, 0.0)), f.x), mix(grainHash(i + vec2(0.0, 1.0)), grainHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Mais forte nos meios-tons, como no filme; quase nada no preto e no branco.
vec3 addGrain(vec3 c, vec2 uv) {
  vec2 q = uv * uResolution / uGrainSize + uSeed;
  float g = grainNoise(q) + grainNoise(q * 1.93 + 17.3) - 1.0;
  float l = clamp(dot(c, LUMA_709), 0.0, 1.0);
  return clamp(c + g * uGrain * 0.18 * (0.3 + 2.8 * l * (1.0 - l)), 0.0, 1.0);
}`;
