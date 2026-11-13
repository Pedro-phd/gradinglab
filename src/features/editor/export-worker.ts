// Worker da exportação: a tela de progresso continua respondendo enquanto o vídeo é processado.
import { runExport, type ExportRequest } from "./export-video";

let controller: AbortController | null = null;

self.onmessage = (event: MessageEvent<ExportRequest | "cancel">) => {
  if (event.data === "cancel") {
    controller?.abort();
    return;
  }
  controller = new AbortController();
  void runExport(event.data, controller.signal, (action) => self.postMessage(action));
};
