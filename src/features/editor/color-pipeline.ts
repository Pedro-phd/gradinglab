// Decisão do pipeline de cor, sem DOM nem WebGL: interface e shader só consomem o plano.

/** Perfil de cor da origem do vídeo. "unknown" é o "Não sei" da interface. */
export type SourceProfile = "apple-log" | "normal" | "unknown";

export type ProfileChoice = {
  profile: SourceProfile;
  /** "none": nada informou o perfil; "manual": o usuário escolheu. */
  source: "none" | "manual";
};

/** O que o navegador informa sobre o espaço de cor do quadro (VideoFrame.colorSpace). */
export type FrameColorInfo = { primaries?: string | null; transfer?: string | null };

export type PipelineWarning = { code: "lut_expects_log_on_normal_source"; message: string };

export type PipelinePlan = {
  /** Converte o quadro antes de entregá-lo à LUT. */
  normalize: boolean;
  /** O "antes" (e a base da intensidade) é o quadro convertido. */
  normalizedBase: boolean;
  applyLook: boolean;
  intensityAvailable: boolean;
  requiresConfirmation: boolean;
  warning: PipelineWarning | null;
};

export function planPipeline(profile: SourceProfile, lutExpectsLog: boolean): PipelinePlan {
  const known = profile !== "unknown";
  const log = profile === "apple-log";
  return {
    // LUT que já espera Log recebe o quadro como está: converter de novo seria transformar duas vezes.
    normalize: log && !lutExpectsLog,
    normalizedBase: log,
    applyLook: known,
    intensityAvailable: known,
    requiresConfirmation: !known,
    warning:
      profile === "normal" && lutExpectsLog
        ? {
            code: "lut_expects_log_on_normal_source",
            message: "Esta LUT foi marcada como esperando Log, mas o vídeo está como Normal. A cor pode sair errada.",
          }
        : null,
  };
}

// As enumerações de VideoColorSpace (bt709, pq, hlg…) não incluem Apple Log, e o nome ou a
// aparência do arquivo não são prova. Por isso nenhum dado do navegador sugere Apple Log ou
// Normal com segurança: a sugestão é sempre "Não sei", e quem escolhe é o usuário.
export function suggestProfile(info: FrameColorInfo | null): ProfileChoice {
  void info;
  return { profile: "unknown", source: "none" };
}

export function chooseProfile(profile: SourceProfile): ProfileChoice {
  return { profile, source: "manual" };
}

/** PQ e HLG são HDR; a prévia só garante SDR. */
export function isHdrFrame(info: FrameColorInfo | null): boolean {
  return info?.transfer === "pq" || info?.transfer === "hlg";
}
