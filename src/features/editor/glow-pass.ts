// Halation e bloom: extrai as luzes acima do limiar e borra em 1/4 da resolução, antes do passe principal.
// Usado pela prévia e pela exportação (mesmo renderizador); sem leitura de pixels.
import type { Glow } from "./effects";
import { BLUR_FRAGMENT, PASS_VERTEX } from "./effects-glsl";

type Locate = (name: string) => WebGLUniformLocation | null;
type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };

export type GlowPass = {
  /** Sem alvo em ponto flutuante a luz vai comprimida em 8 bits; o passe principal precisa saber. */
  packed: boolean;
  /** pair 0 = halation, 1 = bloom, 2 = difusão. setShared aplica no programa de extração os uniforms do quadro e dos ajustes. */
  run(glow: Glow, pair: 0 | 1 | 2, lumaOnly: boolean, width: number, height: number, setShared: (locate: Locate) => void): WebGLTexture;
  dispose(): void;
};

function locator(gl: WebGL2RenderingContext, program: WebGLProgram): Locate {
  const cache = new Map<string, WebGLUniformLocation | null>();
  return (name) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name)!;
  };
}

/** unit: unidade de textura livre, usada para ler a fonte do desfoque. */
export function createGlowPass(
  gl: WebGL2RenderingContext,
  link: (vertex: string, fragment: string) => WebGLProgram,
  brightFragment: string,
  unit: number,
): GlowPass {
  const floatTargets = Boolean(gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float"));
  const bright = link(PASS_VERTEX, brightFragment);
  const blur = link(PASS_VERTEX, BLUR_FRAGMENT);
  const brightAt = locator(gl, bright);
  const blurAt = locator(gl, blur);
  let size = { width: 0, height: 0 };
  let targets: Target[] = [];

  function release() {
    targets.forEach(({ texture, framebuffer }) => {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
    });
    targets = [];
  }

  // Três pares (ida e volta do desfoque): halation, bloom e difusão.
  function ensureTargets(width: number, height: number) {
    if (size.width === width && size.height === height) return;
    release();
    size = { width, height };
    targets = [0, 1, 2, 3, 4, 5].map(() => {
      const texture = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const framebuffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, framebuffer };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  return {
    packed: !floatTargets,
    run(glow, pair, lumaOnly, width, height, setShared) {
      const quarter = { width: Math.max(1, Math.round(width / 4)), height: Math.max(1, Math.round(height / 4)) };
      ensureTargets(quarter.width, quarter.height);
      const [a, b] = [targets[pair * 2]!, targets[pair * 2 + 1]!];
      gl.viewport(0, 0, quarter.width, quarter.height);

      gl.useProgram(bright);
      setShared(brightAt);
      gl.uniform1f(brightAt("uThreshold"), glow.threshold);
      gl.uniform1i(brightAt("uLumaOnly"), lumaOnly ? 1 : 0);
      gl.uniform1i(brightAt("uPack"), floatTargets ? 0 : 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Três rodadas com passo 1, 2 e 4: raio grande com poucas amostras. O raio acompanha o lado menor do quadro.
      const spacing = glow.radius * (Math.min(width, height) / 1080);
      gl.useProgram(blur);
      gl.uniform1i(blurAt("uSource"), unit);
      gl.uniform1i(blurAt("uPack"), floatTargets ? 0 : 1);
      for (const step of [1, 2, 4]) {
        for (const [from, to, horizontal] of [[a, b, true], [b, a, false]] as const) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer);
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, from.texture);
          const distance = step * spacing;
          gl.uniform2f(blurAt("uStep"), horizontal ? distance / quarter.width : 0, horizontal ? 0 : distance / quarter.height);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return a.texture;
    },
    dispose() {
      release();
      gl.deleteProgram(bright);
      gl.deleteProgram(blur);
    },
  };
}
