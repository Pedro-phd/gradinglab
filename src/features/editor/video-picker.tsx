"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { chooseProfile, isHdrFrame, planPipeline, suggestProfile, type FrameColorInfo, type SourceProfile } from "./color-pipeline";
import type { CubeLut } from "./cube-lut";
import { describeDimensions, describeVideoError, formatDuration, validateVideoFile } from "./local-video";
import { ConversionCancelled, convertToH264 } from "./convert-video";
import type { CompareMode } from "./compare";
import { ExportControl } from "./export-screen";
import { ConvertingScreen, HomeScreen } from "./home-screen";
import { LookStrip, ToolBar, type Tool } from "./look-strip";
import { LutPreview, type Snapshot } from "./lut-preview";
import { initialLutState, lutLayers, lutReducer, stackLabel } from "./lut-state";
import { CompareSheet, OriginSheet, profileLabel } from "./source-profile";
import { StackSheet } from "./stack-sheet";
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

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

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
  const active = lutState.stack.at(-1) ?? null;
  const singlePercent = lutState.stack.length === 1 ? lutState.stack[0]!.intensity : null;

  const library = useLutLibrary();
  // Ferramenta aberta: "looks" é a faixa fixa; as outras abrem um painel por cima. A galeria abre a partir da pilha.
  const [tool, setTool] = useState<Tool>("looks");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mode, setMode] = useState<CompareMode>("compare");
  const snapshot = useRef<(() => Snapshot | null) | null>(null);
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

  // Galeria: tocar adiciona; tocar de novo numa que já está na pilha tira a última com esse nome.
  function toggleFromLibrary(id: string) {
    const item = findItem(library.folders, id);
    if (!item?.lut) return;
    const inStack = lutState.stack.findLast((layer) => layer.name === item.fullName);
    dispatchLut(inStack ? { type: "removed", id: inStack.id } : { type: "added", lut: item.lut, name: item.fullName });
  }
  // Faixa de looks: troca o look por cima (a última LUT), como escolher um filtro.
  function pickFromStrip(id: string) {
    const item = findItem(library.folders, id);
    if (item?.lut && item.fullName !== lutState.stack.at(-1)?.name) dispatchLut({ type: "replaced", lut: item.lut, name: item.fullName });
  }
  const thumbFor = (name: string) => {
    const item = library.folders.flatMap((folder) => folder.items).find((entry) => entry.fullName === name);
    return item ? thumbs[item.id] : undefined;
  };
  // As miniaturas saem do quadro pausado: pausar ao abrir a galeria garante que existam.
  function openGallery() {
    document.querySelector<HTMLVideoElement>("main video")?.pause();
    setGalleryOpen(true);
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

  const webCodecs = typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
  const blocked = unsupported ? "Indisponível sem WebGL2." : !webCodecs ? "Este navegador não tem WebCodecs para exportar." : lutState.stack.length === 0 ? "Adicione uma LUT para exportar." : plan.requiresConfirmation ? "Confirme a origem do vídeo para exportar." : null;
  const enabled = !unsupported && plan.intensityAvailable;
  const disabledReason = unsupported ? "Indisponível sem WebGL2." : !plan.intensityAvailable ? "Confirme a origem do vídeo para ajustar as intensidades." : null;
  const closeTool = () => setTool("looks");

  function closeVideo() {
    conversion.current?.abort();
    setTool("looks");
    setState({ kind: "empty" });
  }

  return (
    <main className="group flex flex-1 flex-col">
      {/* Fica fora do fluxo visual, mas focável; os rótulos de cada tela abrem o seletor. */}
      <input id="video-input" type="file" accept="video/*,.mov,.qt,video/quicktime" onChange={handleChange} className="sr-only" />

      {state.kind === "video" ? (
        // Tela cheia, como um editor nativo: vídeo em cima, looks e ferramentas embaixo (à direita no computador).
        <div className="fixed inset-0 flex flex-col overscroll-none bg-black md:grid md:grid-cols-[minmax(0,1fr)_400px] md:grid-rows-[auto_minmax(0,1fr)]">
          <header className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)] md:col-span-2 md:pb-1">
            <button type="button" aria-label="Fechar vídeo" onClick={closeVideo} className={`flex size-11 items-center justify-center rounded-full bg-surface ${focus}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <button type="button" aria-label={`Origem do vídeo: ${profileLabel(choice.profile)}`} onClick={() => setTool("origem")} className={`flex h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold ${focus}`}>
              <span aria-hidden="true" className={`size-2 rounded-full ${choice.profile === "unknown" ? "bg-amber-400" : "bg-accent"}`} />
              {profileLabel(choice.profile)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <ExportControl
              key={state.url}
              file={state.file}
              lutName={active?.name ?? null}
              color={{ profile: choice.profile, lutExpectsLog, layers, normalizationLut: appleLut }}
              blocked={blocked}
              snapshot={() => snapshot.current?.() ?? null}
            />
          </header>

          <section aria-label="Prévia do vídeo" className="flex min-h-0 flex-1 flex-col px-3 pt-3 md:pb-3">
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
              mode={mode}
              snapshotRef={snapshot}
              onUnsupported={markUnsupported}
              onLoadedMetadata={handleMetadata}
              onVideoError={handleVideoError}
            />
          </section>

          <div className="flex shrink-0 flex-col md:justify-end md:border-l md:border-white/10">
            <LookStrip
              folders={library.folders}
              thumbs={thumbs}
              active={active && { name: active.name, intensity: active.intensity }}
              enabled={enabled}
              onPick={pickFromStrip}
              onIntensity={(percent) => active && dispatchLut({ type: "intensity", id: active.id, percent })}
              notice={
                lutState.stack.length > 0 && plan.requiresConfirmation && !unsupported ? (
                  <button type="button" onClick={() => setTool("origem")} className={`mx-5 rounded-2xl bg-amber-500/15 px-4 py-3 text-left text-[13px] text-amber-200 ${focus}`}>
                    Confirme a origem do vídeo (Apple Log ou Normal) para aplicar o look. Toque para escolher.
                  </button>
                ) : null
              }
            />
            <ToolBar current={tool} onSelect={setTool} />
          </div>

          <StackSheet open={tool === "pilha"} onClose={closeTool} state={lutState} dispatch={dispatchLut} enabled={enabled} disabledReason={disabledReason} plan={plan} thumbFor={thumbFor} onAdd={openGallery} />
          <OriginSheet
            open={tool === "origem"}
            onClose={closeTool}
            choice={choice}
            plan={plan}
            lutExpectsLog={lutExpectsLog}
            hdr={hdr}
            disabled={unsupported}
            onChoose={(profile: SourceProfile) => setChoice(chooseProfile(profile))}
            video={{
              name: state.name,
              details: state.metadata
                ? `${formatDuration(state.metadata.duration)} · ${describeDimensions(state.metadata.width, state.metadata.height)}${state.converted ? " · convertido neste aparelho (8 bits)" : ""}`
                : "Lendo informações do vídeo…",
            }}
            onPickAnother={() => {
              closeTool();
              document.getElementById("video-input")?.click();
            }}
          />
          <CompareSheet open={tool === "comparar"} onClose={closeTool} mode={mode} onChange={setMode} />
          <LutGallery
            open={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            folders={library.folders}
            thumbs={thumbs}
            thumbStatus={thumbStatus}
            disabled={unsupported}
            stacked={lutState.stack.map((layer) => layer.name)}
            error={lutState.error}
            onToggle={toggleFromLibrary}
            onImport={(files, fallbackName) => void library.importFiles(files, fallbackName)}
            onRemoveFolder={library.removeFolder}
          />
        </div>
      ) : state.kind === "converting" ? (
        <ConvertingScreen name={state.name} progress={state.progress} onCancel={closeVideo} />
      ) : (
        <HomeScreen inputId="video-input" error={state.kind === "error" ? { message: state.message, attempt: state.attempt } : null} />
      )}
    </main>
  );
}
