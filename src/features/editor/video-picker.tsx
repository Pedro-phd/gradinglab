"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { chooseProfile, isHdrFrame, planPipeline, suggestProfile, type FrameColorInfo, type SourceProfile } from "./color-pipeline";
import type { CubeLut } from "./cube-lut";
import {
  describeDimensions,
  describeVideoError,
  formatDuration,
  validateVideoFile,
} from "./local-video";
import { ConversionCancelled, convertToH264 } from "./convert-video";
import { LookPanel } from "./look-panel";
import { LutPreview } from "./lut-preview";
import { ExportSection } from "./export-panel";
import { initialLutState, lutLayers, lutReducer, stackLabel } from "./lut-state";
import { LutGallery } from "./lut-gallery";
import { findItem } from "./lut-library";
import { useLookThumbnails } from "./use-look-thumbnails";
import { fetchBundled, useLutLibrary } from "./use-lut-library";

type Metadata = { duration: number; width: number; height: number };

type State =
  | { kind: "empty" }
  | { kind: "error"; message: string; attempt: number }
  // converting: o navegador não decodifica o original; uma cópia H.264 está sendo gerada neste aparelho.
  | { kind: "converting"; name: string; progress: number }
  // converted: o arquivo em uso é a cópia H.264 (8 bits); a exportação sai dela.
  | { kind: "video"; name: string; file: File; url: string; autoPlay: boolean; metadata: Metadata | null; converted: boolean };

const panel = "rounded-[28px] border border-white/10 bg-white/[.07] backdrop-blur-xl";
// Por id: o foco do input da LUT não deve acender os labels do vídeo.
const pill =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-semibold motion-safe:transition-colors group-has-[#video-input:focus-visible]:outline-2 group-has-[#video-input:focus-visible]:outline-offset-2 group-has-[#video-input:focus-visible]:outline-white";

export function VideoPicker() {
  const [state, setState] = useState<State>({ kind: "empty" });
  const [lutState, dispatchLut] = useReducer(lutReducer, initialLutState);
  const [unsupported, setUnsupported] = useState(false);
  const [choice, setChoice] = useState(() => suggestProfile(null));
  const [hdr, setHdr] = useState(false);
  const markUnsupported = useCallback(() => setUnsupported(true), []);
  const url = state.kind === "video" ? state.url : null;
  const lutExpectsLog = lutState.firstExpectsLog;
  const plan = planPipeline(choice.profile, lutExpectsLog);
  // O que a prévia mostra é o que a exportação leva. useMemo: a prévia redesenha quando a pilha muda.
  const layers = useMemo(() => lutLayers(lutState, plan.intensityAvailable), [lutState, plan.intensityAvailable]);
  const label = stackLabel(lutState);
  const singlePercent = lutState.stack.length === 1 ? lutState.stack[0]!.intensity : null;

  const library = useLutLibrary();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pausedFrame, setPausedFrame] = useState<{ video: HTMLVideoElement | null; version: number }>({ video: null, version: 0 });
  const markPausedFrame = useCallback((video: HTMLVideoElement | null) => setPausedFrame((current) => ({ video, version: current.version + 1 })), []);
  // Apple Log: a conversão para Rec.709 é a LUT da Apple, baixada do próprio app só quando o perfil pede.
  const [appleLut, setAppleLut] = useState<CubeLut | null>(null);
  const needsAppleLut = plan.normalizedBase && !appleLut;
  useEffect(() => {
    if (!needsAppleLut) return;
    let active = true;
    void fetchBundled("/luts/apple/apple-log-to-rec709.cube").then((loaded) => active && loaded.lut && setAppleLut(loaded.lut));
    return () => {
      active = false;
    };
  }, [needsAppleLut]);
  const normalization = useMemo(() => ({ normalizedBase: plan.normalizedBase, lookInput: plan.normalize, lut: appleLut }), [plan.normalizedBase, plan.normalize, appleLut]);
  const candidates = useMemo(() => library.folders.flatMap((folder) => folder.items.flatMap((item) => (item.lut ? [{ id: item.id, lut: item.lut }] : []))), [library.folders]);
  const thumbs = useLookThumbnails({ video: pausedFrame.video, frameVersion: pausedFrame.version, base: layers, normalization, candidates, enabled: !unsupported && plan.applyLook });
  const thumbStatus = unsupported ? "Indisponível sem WebGL2." : !plan.applyLook ? "Confirme a origem do vídeo para gerar as miniaturas." : null;

  function addFromLibrary(id: string) {
    const item = findItem(library.folders, id);
    if (!item?.lut) return;
    dispatchLut({ type: "added", lut: item.lut, name: item.fullName });
    setGalleryOpen(false);
  }
  // A cópia convertida não carrega as primárias do original: a sugestão de perfil usa o que o ffmpeg leu da origem.
  const sourceColor = useRef<FrameColorInfo | null>(null);
  const markFrameColor = useCallback((frame: FrameColorInfo | null) => {
    const info = sourceColor.current ?? frame;
    setChoice((current) => (current.source === "manual" ? current : suggestProfile(info)));
    setHdr(isHdrFrame(info));
  }, []);

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

  // Abre o arquivo na prévia. Com movimento reduzido ela não toca sozinha; os controles continuam visíveis.
  function openVideo(file: File, name: string, converted: boolean, color: FrameColorInfo | null = null) {
    sourceColor.current = color;
    const autoPlay = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState({ kind: "video", name, file, url: URL.createObjectURL(file), autoPlay, metadata: null, converted });
  }

  const conversion = useRef<AbortController | null>(null);
  useEffect(() => () => conversion.current?.abort(), []);

  // O navegador não decodificou o original (ex.: ProRes no Chrome): converte aqui mesmo e abre a cópia.
  function convert(file: File, name: string) {
    conversion.current?.abort();
    const controller = new AbortController();
    conversion.current = controller;
    setState({ kind: "converting", name, progress: 0 });
    convertToH264(file, controller.signal, (progress) => setState((current) => (current.kind === "converting" ? { ...current, progress } : current)))
      .then((converted) => !controller.signal.aborted && openVideo(converted.file, name, true, converted.sourceColor))
      .catch((error: unknown) => {
        if (error instanceof ConversionCancelled) return;
        showError("Não foi possível converter este vídeo neste navegador. Tente outro arquivo ou outro navegador.");
      });
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
    setUnsupported(false);
    setChoice(suggestProfile(null)); // o perfil é do vídeo: cada arquivo começa sem escolha
    setHdr(false);
    conversion.current?.abort();
    openVideo(file, file.name, false);
  }

  function handleMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const { duration, videoWidth, videoHeight } = event.currentTarget;
    // Só o áudio abriu: o navegador não decodifica a imagem deste arquivo.
    if (videoWidth === 0 && state.kind === "video" && !state.converted) return convert(state.file, state.name);
    setState((current) =>
      current.kind === "video"
        ? { ...current, metadata: { duration, width: videoWidth, height: videoHeight } }
        : current,
    );
  }

  function handleVideoError(event: SyntheticEvent<HTMLVideoElement>) {
    const code = event.currentTarget.error?.code;
    // 3 = decodificação, 4 = formato não suportado: tenta a conversão local antes de desistir.
    if ((code === 3 || code === 4) && state.kind === "video" && !state.converted) return convert(state.file, state.name);
    showError(describeVideoError(code));
  }

  const pickerLabel = (text: string, className: string) => (
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
        accept="video/*,.mov,.qt,video/quicktime"
        onChange={handleChange}
        className="sr-only"
      />

      {state.kind === "video" ? (
        // No celular a intensidade fica logo abaixo do vídeo; no computador, no painel lateral.
        <div className="grid flex-1 content-start gap-4 md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-[1fr_auto]">
          <section aria-label="Prévia do vídeo" className="flex min-w-0 flex-col items-center justify-start gap-3 md:justify-center">
            {lutState.stack.length > 0 && plan.requiresConfirmation && !unsupported && (
              <p role="status" className="w-full rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
                Confirme a origem do vídeo (Apple Log ou Normal) para aplicar o look. Enquanto isso, a prévia mostra o quadro sem alteração.
              </p>
            )}
            <LutPreview
              key={state.url}
              src={state.url}
              autoPlay={state.autoPlay}
              layers={layers}
              lutName={label}
              intensityPercent={singlePercent}
              awaitingProfile={!plan.applyLook}
              normalizedBase={plan.normalizedBase}
              normalizedLookInput={plan.normalize}
              normalizationLut={appleLut}
              onFrameColor={markFrameColor}
              onPausedFrame={markPausedFrame}
              unsupported={unsupported}
              onUnsupported={markUnsupported}
              onLoadedMetadata={handleMetadata}
              onVideoError={handleVideoError}
            />
          </section>
          <section
            aria-label="Informações do vídeo"
            className={`${panel} order-3 flex min-w-0 flex-wrap items-center justify-between gap-4 p-4 md:order-none`}
          >
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold">{state.name}</h2>
              <p className="text-sm text-muted">
                {state.metadata
                  ? `${formatDuration(state.metadata.duration)} · ${describeDimensions(state.metadata.width, state.metadata.height)}${state.converted ? " · convertido neste aparelho (8 bits)" : ""}`
                  : "Lendo informações do vídeo…"}
              </p>
            </div>
            {pickerLabel("Escolher outro vídeo", "border border-white/20 text-foreground hover:bg-white/10")}
          </section>
          <LookPanel
            state={lutState}
            dispatch={dispatchLut}
            unsupported={unsupported}
            choice={choice}
            plan={plan}
            hdr={hdr}
            onProfileChange={(profile: SourceProfile) => setChoice(chooseProfile(profile))}
            onOpenGallery={() => {
              // As miniaturas saem do quadro pausado: pausar ao abrir garante que existam.
              document.querySelector<HTMLVideoElement>("main video")?.pause();
              setGalleryOpen(true);
            }}
            exportSection={
              <ExportSection
                key={state.url}
                file={state.file}
                lutName={lutState.stack.at(-1)?.name ?? null}
                summary={label === null ? "sem LUT" : singlePercent === null ? label : `${label} · ${singlePercent}%`}
                color={{ profile: choice.profile, lutExpectsLog, layers, normalizationLut: appleLut }}
                blocked={unsupported ? "Indisponível sem WebGL2." : lutState.stack.length === 0 ? "Adicione uma LUT para exportar." : plan.requiresConfirmation ? "Confirme a origem do vídeo para exportar." : null}
              />
            }
          />
        </div>
      ) : state.kind === "converting" ? (
        <section aria-labelledby="convertendo-titulo" className={`${panel} m-auto flex w-full max-w-xl flex-col items-center gap-5 p-8 text-center`}>
          <h2 id="convertendo-titulo" className="font-display text-2xl font-semibold">Convertendo o vídeo</h2>
          <p className="text-sm text-muted">
            Este navegador não abre o formato de <strong className="text-foreground">{state.name}</strong> (ex.: ProRes). Uma cópia em H.264 está sendo gerada aqui no seu aparelho; nada é enviado. Pode levar alguns minutos.
          </p>
          <div role="progressbar" aria-label="Conversão do vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress * 100)} className="h-2.5 w-full overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-accent" style={{ width: `${state.progress * 100}%` }} />
          </div>
          <p className="font-display text-xl font-semibold tabular-nums text-accent">{Math.round(state.progress * 100)}%</p>
          <button type="button" onClick={() => { conversion.current?.abort(); setState({ kind: "empty" }); }} className="h-11 rounded-full border border-white/20 px-5 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Cancelar</button>
        </section>
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
          {pickerLabel(
            state.kind === "error" ? "Tentar outro vídeo" : "Escolher vídeo",
            "bg-accent text-accent-ink hover:brightness-110",
          )}
        </section>
      )}
      <LutGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        folders={library.folders}
        thumbs={thumbs}
        thumbStatus={thumbStatus}
        disabled={unsupported}
        onAdd={addFromLibrary}
        onImport={(files, fallbackName) => void library.importFiles(files, fallbackName)}
        onRemoveFolder={library.removeFolder}
      />
    </main>
  );
}
