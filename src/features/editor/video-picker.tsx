"use client";

import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import {
  describeDimensions,
  describeVideoError,
  formatDuration,
  validateVideoFile,
} from "./local-video";

type Metadata = { duration: number; width: number; height: number };

type State =
  | { kind: "empty" }
  | { kind: "error"; message: string; attempt: number }
  | { kind: "video"; name: string; url: string; autoPlay: boolean; metadata: Metadata | null };

const panel = "rounded-[28px] border border-white/10 bg-white/[.07] backdrop-blur-xl";
const pill =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-semibold motion-safe:transition-colors group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-white";

export function VideoPicker() {
  const [state, setState] = useState<State>({ kind: "empty" });
  const url = state.kind === "video" ? state.url : null;

  // A URL local aponta para o arquivo no aparelho; libera ao trocar de vídeo ou sair da tela.
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  // O contador remonta o aviso, para o leitor de tela repetir a mesma mensagem.
  function showError(message: string) {
    setState((current) => ({
      kind: "error",
      message,
      attempt: current.kind === "error" ? current.attempt + 1 : 1,
    }));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    const result = validateVideoFile(file);
    if (!result.ok) {
      showError(result.error.message);
      return;
    }
    // Com movimento reduzido a prévia não toca sozinha; os controles continuam visíveis.
    const autoPlay = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState({
      kind: "video",
      name: file.name,
      url: URL.createObjectURL(file),
      autoPlay,
      metadata: null,
    });
  }

  function handleMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const { duration, videoWidth, videoHeight } = event.currentTarget;
    setState((current) =>
      current.kind === "video"
        ? { ...current, metadata: { duration, width: videoWidth, height: videoHeight } }
        : current,
    );
  }

  function handleVideoError(event: SyntheticEvent<HTMLVideoElement>) {
    showError(describeVideoError(event.currentTarget.error?.code));
  }

  const label = (text: string, className: string) => (
    <label htmlFor="video-input" className={`${pill} ${className}`}>
      {text}
    </label>
  );

  return (
    <main className="group flex flex-1 flex-col gap-4">
      {/* Fica fora do fluxo visual, mas focável; o label real abre o seletor. */}
      <input
        id="video-input"
        type="file"
        accept="video/*"
        onChange={handleChange}
        className="sr-only"
      />

      {state.kind === "video" ? (
        <>
          <section aria-label="Prévia do vídeo" className="flex flex-1 items-start justify-center md:items-center">
            <video
              key={state.url}
              src={state.url}
              controls
              autoPlay={state.autoPlay}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={handleMetadata}
              onError={handleVideoError}
              className="max-h-[70vh] w-full rounded-[28px] bg-black"
            />
          </section>
          <section
            aria-label="Informações do vídeo"
            className={`${panel} flex flex-wrap items-center justify-between gap-4 p-4`}
          >
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold">{state.name}</h2>
              <p className="text-sm text-muted">
                {state.metadata
                  ? `${formatDuration(state.metadata.duration)} · ${describeDimensions(state.metadata.width, state.metadata.height)}`
                  : "Lendo informações do vídeo…"}
              </p>
            </div>
            {label("Escolher outro vídeo", "border border-white/20 text-foreground hover:bg-white/10")}
          </section>
        </>
      ) : (
        <section
          aria-labelledby="entrada-titulo"
          className={`${panel} m-auto flex w-full max-w-xl flex-col items-center gap-5 p-8 text-center`}
        >
          <h2 id="entrada-titulo" className="font-display text-2xl font-semibold">
            Escolha um vídeo do seu aparelho
          </h2>
          {state.kind === "error" && (
            <p key={state.attempt} role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
              {state.message}
            </p>
          )}
          <p className="text-sm text-muted">
            O vídeo é lido direto no seu aparelho. Nenhum byte é enviado e o original não é alterado.
            Os formatos aceitos dependem do seu navegador.
          </p>
          {label(
            state.kind === "error" ? "Tentar outro vídeo" : "Escolher vídeo",
            "bg-accent text-accent-ink hover:brightness-110",
          )}
        </section>
      )}
    </main>
  );
}
