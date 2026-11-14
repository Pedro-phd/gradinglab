import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GradingLab",
  description: "Central de geração, aplicação e edição de looks de cor.",
  // Adicionado à tela de início do iPhone, abre em tela cheia, sem a barra do Safari.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GradingLab" },
};

// viewport-fit=cover: o conteúdo vai até as bordas e cada tela recua pelas áreas seguras (env(safe-area-inset-*)).
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
