import type { Metadata } from "next";
import { VideoPicker } from "@/features/editor/video-picker";

export const metadata: Metadata = {
  title: "Editor — GradingLab",
};

export default function EditorPage() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-base font-semibold">GradingLab</h1>
        <p className="flex h-11 items-center rounded-full border border-white/10 bg-white/10 px-4 text-sm">
          Processado neste dispositivo
        </p>
      </header>
      <VideoPicker />
    </div>
  );
}
