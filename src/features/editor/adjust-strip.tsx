"use client";

import { useState, type ReactNode } from "react";
import { ADJUSTMENTS, hasEffects, isAdjusted, type EffectControl, type EffectKey, type Effects } from "./effects";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Props = {
  effects: Effects;
  enabled: boolean; // perfil confirmado e WebGL2
  notice: ReactNode;
  onChange: (key: EffectKey, value: number) => void;
  onReset: () => void;
};

function Slider({ control, value, primary, disabled, onChange }: { control: EffectControl; value: number; primary: boolean; disabled: boolean; onChange: Props["onChange"] }) {
  const id = `ajuste-${control.key}`;
  return (
    <div className="flex min-h-11 items-center gap-3">
      <label htmlFor={id} className={`w-28 shrink-0 truncate ${primary ? "text-[15px] font-semibold" : "text-[13px] text-muted"}`}>{control.label}</label>
      <input
        id={id}
        type="range"
        min={control.min}
        max={control.max}
        value={value}
        disabled={disabled}
        aria-valuetext={control.format(value)}
        onChange={(event) => onChange(control.key, Number(event.target.value))}
        className={`h-11 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40 ${focus}`}
      />
      <output htmlFor={id} className={`w-14 shrink-0 whitespace-nowrap text-right tabular-nums ${primary ? "text-[15px] font-semibold text-accent" : "text-[13px] text-muted"}`}>{control.format(value)}</output>
    </div>
  );
}

// Como o "Ajustar" do app Fotos: escolhe o ajuste na fileira e regula no controle acima, vendo o vídeo.
// Os efeitos de filme trazem os controles secundários (limiar, raio, tamanho) logo abaixo do principal.
export function AdjustStrip({ effects, enabled, notice, onChange, onReset }: Props) {
  const [selectedId, setSelectedId] = useState(ADJUSTMENTS[0]!.id);
  const selected = ADJUSTMENTS.find((item) => item.id === selectedId) ?? ADJUSTMENTS[0]!;

  return (
    <section aria-label="Ajustes" className="flex flex-col gap-2.5 pt-4">
      {notice}
      {/* Altura de três controles sempre: trocar de ajuste não redimensiona o vídeo. */}
      <div className="flex min-h-[132px] flex-col justify-end px-5">
        {[selected.main, ...selected.extra].map((control, index) => (
          <Slider key={control.key} control={control} value={effects[control.key]} primary={index === 0} disabled={!enabled} onChange={onChange} />
        ))}
      </div>
      <div role="group" aria-label="Escolher ajuste" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
        {ADJUSTMENTS.map((item) => {
          const current = item.id === selected.id;
          const adjusted = isAdjusted(effects, item);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={current}
              aria-label={adjusted ? `${item.label} (ajustado)` : item.label}
              onClick={() => setSelectedId(item.id)}
              className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${current ? "bg-foreground text-accent-ink" : "bg-surface text-foreground"} ${focus}`}
            >
              {item.label}
              {adjusted && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
            </button>
          );
        })}
        {hasEffects(effects) && (
          <button type="button" onClick={onReset} disabled={!enabled} className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold text-danger disabled:opacity-40 ${focus}`}>
            Redefinir
          </button>
        )}
      </div>
    </section>
  );
}
