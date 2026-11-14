import type { Metadata } from "next";
import { VideoPicker } from "@/features/editor/video-picker";

export const metadata: Metadata = {
  title: "Editor — GradingLab",
};

export default function EditorPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <VideoPicker />
    </div>
  );
}
