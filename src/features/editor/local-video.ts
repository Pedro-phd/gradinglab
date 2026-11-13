// Lógica pura do vídeo local: nada aqui lê o conteúdo do arquivo nem acessa a rede.

export type VideoFileError = {
  code: "not_video" | "empty_file";
  message: string;
};

export type VideoFileResult =
  | { ok: true }
  | { ok: false; error: VideoFileError };

// Sem teto de duração ou tamanho: só o navegador decide se consegue reproduzir.
export function validateVideoFile(file: Pick<File, "type" | "size">): VideoFileResult {
  if (file.size === 0) {
    return {
      ok: false,
      error: { code: "empty_file", message: "O arquivo está vazio. Escolha outro vídeo." },
    };
  }
  if (!file.type.startsWith("video/")) {
    return {
      ok: false,
      error: {
        code: "not_video",
        message: "Este arquivo não é um vídeo. Escolha um arquivo de vídeo.",
      },
    };
  }
  return { ok: true };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "duração desconhecida";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function describeDimensions(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return "dimensões desconhecidas";
  const orientation = width > height ? "horizontal" : width < height ? "vertical" : "quadrado";
  return `${width} × ${height} · ${orientation}`;
}

// Códigos de MediaError: 1 abortado, 2 rede, 3 decodificação, 4 formato não suportado.
export function describeVideoError(code: number | undefined): string {
  switch (code) {
    case 1:
      return "A leitura do vídeo foi interrompida. Tente escolher o arquivo novamente.";
    case 2:
      return "Não foi possível ler o arquivo no seu aparelho. Tente escolhê-lo novamente.";
    case 3:
      return "O arquivo parece corrompido ou usa um recurso que este navegador não consegue decodificar.";
    case 4:
      return "Este navegador não consegue abrir o formato deste vídeo.";
    default:
      return "Não foi possível abrir este vídeo neste navegador.";
  }
}
