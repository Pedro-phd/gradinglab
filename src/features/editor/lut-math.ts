// Aritmética da LUT sem WebGL. O shader (lut-renderer.ts) repete mix e normalização na GPU;
// os testes fixam o contrato aqui.
import type { CubeLut } from "./cube-lut";

type Rgb = [number, number, number];

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** base·(1−t) + look·t: em t=0 e t=1 devolve exatamente base e look. */
export function mixIntensity(base: Rgb, look: Rgb, intensity: number): Rgb {
  const t = clamp01(intensity);
  return [base[0] * (1 - t) + look[0] * t, base[1] * (1 - t) + look[1] * t, base[2] * (1 - t) + look[2] * t];
}

/** Entrada → 0..1 pelo domínio da LUT; fora dele vale a borda. */
export function normalizeInput(value: number, domainMin: number, domainMax: number): number {
  return Math.min(1, Math.max(0, (value - domainMin) / (domainMax - domainMin)));
}

/**
 * Dados para a textura 3D (largura = vermelho, altura = verde, profundidade = azul).
 * A ordem do arquivo (vermelho varia mais rápido) já é a ordem de texels da textura,
 * então os dados passam sem reordenar. Coordenada de amostragem = normalizada·scale + offset,
 * que cai no centro dos texels: 0 → 0,5/N e 1 → (N−0,5)/N.
 */
export function lutTexture(lut: CubeLut) {
  const { size, data, domainMin, domainMax } = lut;
  return { size, data, domainMin, domainMax, scale: (size - 1) / size, offset: 0.5 / size };
}
